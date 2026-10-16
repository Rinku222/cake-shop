import { useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { Button } from '@/components/ui';
import { BackupAccessNeededError, getBackupStatus, readAutoBackup, requestBackupAccess } from '@/lib/backup';
import { PersistedState, useStore } from '@/lib/store';

/** Reads the backup, asking for access to the backup folder first if Android requires it. */
async function loadBackup(): Promise<PersistedState | null | 'cancelled'> {
  try {
    return await readAutoBackup();
  } catch (e) {
    if (!(e instanceof BackupAccessNeededError)) throw e;
    const proceed = await new Promise<boolean>((resolve) =>
      Alert.alert(
        'Allow access to your backup',
        'Android needs your permission to open the “Cake Customers” folder.\n\nOn the next screen, tap “Use this folder”, then “Allow”.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Continue', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      ),
    );
    if (!proceed || !(await requestBackupAccess())) return 'cancelled';
    return readAutoBackup();
  }
}

/**
 * "Restore backup" action for empty screens (e.g. after clearing the app's data or reinstalling).
 * Shown only when the backup folder (Documents/Cake Customers) exists on the phone.
 */
export function RestoreBackupButton() {
  const { replaceAll } = useStore();
  const [hasBackup, setHasBackup] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let mounted = true;
    const refresh = () => getBackupStatus().then((s) => mounted && setHasBackup(s.fileExists));
    refresh();
    const sub = AppState.addEventListener('change', (next) => next === 'active' && refresh());
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  if (!hasBackup) return null;

  const restore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const backup = await loadBackup();
      if (backup === 'cancelled') return;
      if (!backup) {
        Alert.alert('No backup found', 'The “Cake Customers” folder has no backup file in it yet.');
        return;
      }
      Alert.alert('Restore backup?', `Restore ${backup.customers.length} customers and your settings from the backup?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', onPress: () => replaceAll(backup) },
      ]);
    } catch (e) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : 'Could not read the backup.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Button
      title="Restore backup"
      icon="folder-open-outline"
      variant="secondary"
      onPress={restore}
      disabled={restoring}
    />
  );
}
