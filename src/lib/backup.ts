import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, PermissionsAndroid } from 'react-native';
import SharedBackup, { NEEDS_FOLDER_ACCESS } from '../../modules/shared-backup';
import type { PersistedState } from './store';

export const BACKUP_FILE_NAME = 'cake-shop-backup.json';

export interface BackupStatus {
  /** Whether the backup folder / file is present on the phone. */
  fileExists: boolean;
  /** Human-readable location of the backup file. */
  location: string;
}

/**
 * Where the auto-backup lives:
 * - Android: one fixed folder, Documents/Cake Customers (via the local `shared-backup` module).
 *   It survives "Clear data" and reinstalling the app. After either of those, Android asks the
 *   user once to allow access to that folder (see requestBackupAccess()).
 * - Elsewhere (iOS, Expo Go): the app's documents folder. iOS has no "Clear data"; it is
 *   only removed together with the app.
 */
const LOCAL_FOLDER = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}cake customers` : null;
const LOCAL_FILE = LOCAL_FOLDER ? `${LOCAL_FOLDER}/${BACKUP_FILE_NAME}` : null;

export const BACKUP_LOCATION = SharedBackup?.location ?? `App documents/cake customers/${BACKUP_FILE_NAME}`;

/** Thrown when Android needs the user to allow access to the backup folder first. */
export class BackupAccessNeededError extends Error {
  constructor() {
    super('Allow access to the backup folder first.');
  }
}

function isAccessError(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === NEEDS_FOLDER_ACCESS;
}

/**
 * Asks for access to the backup folder: the legacy storage permission on Android 9 and older,
 * otherwise the system folder picker opened right at Documents/Cake Customers.
 * Resolves true when access was granted.
 */
export async function requestBackupAccess(): Promise<boolean> {
  if (!SharedBackup) return true;
  if (SharedBackup.needsLegacyPermission()) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    ]);
    return Object.values(result).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
  }
  try {
    return await SharedBackup.requestFolderAccessAsync();
  } catch (e) {
    Alert.alert('Wrong folder', e instanceof Error ? e.message : 'Please choose the “Cake Customers” folder.');
    return false;
  }
}

/** Whether a backup is present: on Android, whether the Documents/Cake Customers folder exists. */
export async function getBackupStatus(): Promise<BackupStatus> {
  try {
    if (SharedBackup) {
      return { fileExists: await SharedBackup.folderExistsAsync(), location: BACKUP_LOCATION };
    }
    if (!LOCAL_FILE) return { fileExists: false, location: BACKUP_LOCATION };
    return { fileExists: (await FileSystem.getInfoAsync(LOCAL_FILE)).exists, location: BACKUP_LOCATION };
  } catch (e) {
    console.warn('Backup status check failed', e);
    return { fileExists: false, location: BACKUP_LOCATION };
  }
}

/**
 * Programmatic auto-backup: writes the latest data to the backup file (creating the folder if
 * needed), alongside local storage. Throws BackupAccessNeededError when Android needs the user
 * to allow folder access first; other failures are logged and return false.
 */
export async function saveAutoBackup(state: PersistedState): Promise<boolean> {
  const content = JSON.stringify(state);
  try {
    if (SharedBackup) {
      if (SharedBackup.needsLegacyPermission()) throw new BackupAccessNeededError();
      await SharedBackup.writeAsync(content);
      return true;
    }
    if (!LOCAL_FOLDER || !LOCAL_FILE) return false;
    if (!(await FileSystem.getInfoAsync(LOCAL_FOLDER)).exists) {
      await FileSystem.makeDirectoryAsync(LOCAL_FOLDER, { intermediates: true });
    }
    await FileSystem.writeAsStringAsync(LOCAL_FILE, content);
    return true;
  } catch (e) {
    if (e instanceof BackupAccessNeededError || isAccessError(e)) throw new BackupAccessNeededError();
    console.warn('Auto backup failed', e);
    return false;
  }
}

/**
 * Reads and validates the auto-backup, or null if there is none. Throws
 * BackupAccessNeededError when Android needs the user to allow folder access first.
 */
export async function readAutoBackup(): Promise<PersistedState | null> {
  try {
    if (SharedBackup) {
      if (SharedBackup.needsLegacyPermission()) throw new BackupAccessNeededError();
      const content = await SharedBackup.readAsync();
      return content ? parseBackup(content) : null;
    }
    if (!LOCAL_FILE || !(await FileSystem.getInfoAsync(LOCAL_FILE)).exists) return null;
    return parseBackup(await FileSystem.readAsStringAsync(LOCAL_FILE));
  } catch (e) {
    if (e instanceof BackupAccessNeededError || isAccessError(e)) throw new BackupAccessNeededError();
    console.warn('Read auto backup failed', e);
    return null;
  }
}

/**
 * Writes a backup file and opens the share sheet so the user can keep a durable
 * copy anywhere (Downloads, Drive, WhatsApp…) that survives clearing data or reinstalls.
 */
export async function exportBackupFile(state: PersistedState): Promise<{ ok: boolean; message: string }> {
  try {
    if (!FileSystem.cacheDirectory) return { ok: false, message: 'File sharing is not available here.' };
    const uri = `${FileSystem.cacheDirectory}cake-shop-backup.json`;
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(state));
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/json',
        dialogTitle: 'Save a copy of your data',
        UTI: 'public.json',
      });
      return { ok: true, message: 'Kept. Save this file somewhere safe to restore later.' };
    }
    return { ok: false, message: 'Sharing is not available on this device.' };
  } catch (e) {
    console.warn('Export backup failed', e);
    return { ok: false, message: 'Could not export the backup.' };
  }
}

/**
 * Opens the system file picker, reads the chosen backup JSON and returns it,
 * or null if the user cancels.
 */
export async function pickBackupFile(): Promise<{ name: string; content: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/json', 'application/octet-stream'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets || result.assets.length === 0) return null;
  const asset = result.assets[0];
  const content = await FileSystem.readAsStringAsync(asset.uri);
  return { name: asset.name, content };
}

/** Validates that a parsed backup has the expected shape and returns it. */
export function parseBackup(content: string): PersistedState {
  const parsed = JSON.parse(content) as Partial<PersistedState>;
  if (!Array.isArray(parsed.customers) || typeof parsed.settings !== 'object' || parsed.settings === null) {
    throw new Error('This file does not look like a valid Cake Shop backup.');
  }
  return { customers: parsed.customers, settings: parsed.settings };
}
