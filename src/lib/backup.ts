import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { PersistedState } from './store';

export const BACKUP_FOLDER_NAME = 'cake customers';
export const BACKUP_FILE_NAME = 'cake-shop-backup.json';

export interface BackupStatus {
  folderExists: boolean;
  fileExists: boolean;
  folderPath?: string;
  filePath?: string;
}

function autoBackupFolderUri(): string | null {
  return FileSystem.documentDirectory ? FileSystem.documentDirectory + BACKUP_FOLDER_NAME : null;
}

function autoBackupFileUri(): string | null {
  const dir = autoBackupFolderUri();
  return dir ? `${dir}/${BACKUP_FILE_NAME}` : null;
}

/** Creates the "cake customers" folder inside the app's documents if it doesn't exist. */
async function ensureAutoBackupFolder(): Promise<void> {
  const dir = autoBackupFolderUri();
  if (!dir) return;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

/** Whether the "cake customers" folder and its backup file exist right now. */
export async function getBackupStatus(): Promise<BackupStatus> {
  const folderPath = autoBackupFolderUri();
  if (!folderPath) return { folderExists: false, fileExists: false };
  const folderInfo = await FileSystem.getInfoAsync(folderPath);
  if (!folderInfo.exists || !folderInfo.isDirectory) {
    return { folderExists: false, fileExists: false, folderPath };
  }
  const filePath = `${folderPath}/${BACKUP_FILE_NAME}`;
  const fileInfo = await FileSystem.getInfoAsync(filePath);
  return { folderExists: true, fileExists: fileInfo.exists, folderPath, filePath };
}

/**
 * Programmatic auto-backup: whenever data changes, the app creates the "cake customers"
 * folder (if needed) and writes the latest data into it, alongside local storage.
 */
export async function saveAutoBackup(state: PersistedState): Promise<void> {
  const fileUri = autoBackupFileUri();
  if (!fileUri) return;
  try {
    await ensureAutoBackupFolder();
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(state));
  } catch (e) {
    console.warn('Auto backup failed', e);
  }
}

/** Reads the backup from the "cake customers" folder, or null if it isn't there. */
export async function readAutoBackup(): Promise<PersistedState | null> {
  const status = await getBackupStatus();
  if (!status.filePath || !status.fileExists) return null;
  try {
    return parseBackup(await FileSystem.readAsStringAsync(status.filePath));
  } catch (e) {
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
