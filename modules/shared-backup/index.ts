import { requireOptionalNativeModule } from 'expo';

type SharedBackupModule = {
  /** Backup path relative to the phone's shared storage ("Documents/Cake Customers/…json"). */
  readonly location: string;
  /** Whether the Documents/Cake Customers folder exists (no permission needed). */
  folderExistsAsync(): Promise<boolean>;
  /** Backup contents, or null if there is none. Rejects with ERR_NEEDS_FOLDER_ACCESS when a folder grant is needed. */
  readAsync(): Promise<string | null>;
  /** Rejects with ERR_NEEDS_FOLDER_ACCESS when a folder grant is needed. */
  writeAsync(content: string): Promise<void>;
  /** Opens the system folder picker at the backup folder. true = access granted, false = cancelled. */
  requestFolderAccessAsync(): Promise<boolean>;
  /** Android 9 and older: the legacy storage permission is still missing. */
  needsLegacyPermission(): boolean;
};

export const NEEDS_FOLDER_ACCESS = 'ERR_NEEDS_FOLDER_ACCESS';

/** Android-only. null on iOS, web and Expo Go (no custom native code there). */
export default requireOptionalNativeModule<SharedBackupModule>('SharedBackup');
