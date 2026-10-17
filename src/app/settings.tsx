import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Field, SectionTitle } from '@/components/ui';
import {
  BackupAccessNeededError,
  BACKUP_LOCATION,
  exportBackupFile,
  getBackupStatus,
  parseBackup,
  pickBackupFile,
  requestBackupAccess,
  saveAutoBackup,
} from '@/lib/backup';
import { buildReminderMessage } from '@/lib/messaging';
import { buildSampleCustomers } from '@/lib/sampleData';
import { DEFAULT_SETTINGS, useStore } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';
import { Customer } from '@/lib/types';

const PREVIEW_CUSTOMER: Customer = {
  id: 'preview',
  name: 'Priya Sharma',
  phone: '',
  favoriteFlavor: 'Chocolate truffle',
  occasions: [],
  orders: [],
  contactLog: [],
  feedbackLog: [],
  createdAt: '',
};

export default function SettingsScreen() {
  const { settings, updateSettings, customers, replaceAll, backupNeedsAccess } = useStore();
  const [importText, setImportText] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupStatus, setBackupStatus] = useState<Awaited<ReturnType<typeof getBackupStatus>> | null>(null);

  useEffect(() => {
    getBackupStatus().then(setBackupStatus);
  }, [customers, settings]);

  const saveNow = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      let ok: boolean;
      try {
        ok = await saveAutoBackup({ customers, settings });
      } catch (e) {
        if (!(e instanceof BackupAccessNeededError) || !(await requestBackupAccess())) return;
        ok = await saveAutoBackup({ customers, settings });
      }
      setBackupStatus(await getBackupStatus());
      Alert.alert(
        ok ? 'Backup saved' : 'Backup failed',
        ok ? `Your latest data is saved in ${BACKUP_LOCATION}.` : 'Could not write the backup file.',
      );
    } finally {
      setBackupBusy(false);
    }
  };

  const exportCopy = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const result = await exportBackupFile({ customers, settings });
      Alert.alert(result.ok ? 'Export ready' : 'Export failed', result.message);
    } finally {
      setBackupBusy(false);
    }
  };

  const restoreFromFile = async () => {
    if (backupBusy) return;
    try {
      const file = await pickBackupFile();
      if (!file) return;
      const parsed = parseBackup(file.content);
      Alert.alert(
        'Restore from file?',
        `This will replace your current ${customers.length} customers with the ${parsed.customers.length} customers in “${file.name}”.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Restore', style: 'destructive', onPress: () => replaceAll(parsed) },
        ],
      );
    } catch (e) {
      Alert.alert('Invalid backup', e instanceof Error ? e.message : 'Could not read this file.');
    }
  };

  const preview = buildReminderMessage(
    PREVIEW_CUSTOMER,
    { id: 'p', type: 'birthday', forWhom: 'Son Aarav', day: 20, month: 10, year: 2019 },
    new Date(new Date().getFullYear(), 9, 20),
    settings,
  );

  const exportData = () =>
    Share.share({ title: 'Cake shop backup', message: JSON.stringify({ customers, settings }) }).catch(() => {});

  const importData = () => {
    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed.customers)) throw new Error('missing customers');
      Alert.alert('Replace all data?', `This will replace your ${customers.length} customers with ${parsed.customers.length} from the backup.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () => {
            replaceAll(parsed);
            setImportText('');
          },
        },
      ]);
    } catch {
      Alert.alert('Invalid backup', 'Paste the exact text you exported from this app.');
    }
  };

  const loadSample = () =>
    Alert.alert('Add demo customers?', 'Adds 6 sample customers so you can try the app.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add', onPress: () => replaceAll({ customers: [...customers, ...buildSampleCustomers()], settings }) },
    ]);

  const clearAll = () =>
    Alert.alert('Delete everything?', 'All customers, orders and reminders will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete all', style: 'destructive', onPress: () => replaceAll({ customers: [], settings }) },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <SectionTitle>Shop</SectionTitle>
        <Card>
          <Field label="Shop name" value={settings.shopName} onChangeText={(shopName) => updateSettings({ shopName })} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field
                label="Country code"
                value={settings.countryCode}
                onChangeText={(t) => updateSettings({ countryCode: t.replace(/\D/g, '') })}
                keyboardType="number-pad"
                hint="Added to 10-digit numbers for WhatsApp"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Currency" value={settings.currency} onChangeText={(currency) => updateSettings({ currency })} />
            </View>
          </View>
          <Field
            label="Swiggy shop link"
            value={settings.swiggyUrl ?? ''}
            onChangeText={(swiggyUrl) => updateSettings({ swiggyUrl })}
            placeholder="https://www.swiggy.com/menu/…"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            hint="Added to the WhatsApp message as “Order again on Swiggy”"
          />
          <Field
            label="Zomato shop link"
            value={settings.zomatoUrl ?? ''}
            onChangeText={(zomatoUrl) => updateSettings({ zomatoUrl })}
            placeholder="https://zomato.onelink.me/…"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            hint="Added to the WhatsApp message as “Order again on Zomato”"
          />
          <Field
            label="Shop location link"
            value={settings.mapsUrl ?? ''}
            onChangeText={(mapsUrl) => updateSettings({ mapsUrl })}
            placeholder="https://maps.app.goo.gl/…"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            hint="Google Maps link, added to the WhatsApp message as “Visit our shop”"
          />
          <Field
            label="Google review link"
            value={settings.reviewUrl ?? ''}
            onChangeText={(reviewUrl) => updateSettings({ reviewUrl })}
            placeholder="https://www.google.com/maps/place/…"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            hint="Sent to new customers asking for a Google review"
          />
        </Card>

        <SectionTitle
          right={
            <Button
              title="Reset"
              variant="ghost"
              compact
              onPress={() => updateSettings({ messageTemplate: DEFAULT_SETTINGS.messageTemplate })}
            />
          }
        >
          Reminder message
        </SectionTitle>
        <Card>
          <Field
            label="Template"
            value={settings.messageTemplate}
            onChangeText={(messageTemplate) => updateSettings({ messageTemplate })}
            multiline
            style={{ minHeight: 110, textAlignVertical: 'top' }}
            hint="Placeholders: {name} {whose} {occasion} {when} {reorder} {date} {shop} {flavor}"
          />
          <Text style={styles.previewLabel}>Preview</Text>
          <View style={styles.preview}>
            <Text style={styles.previewText}>{preview}</Text>
          </View>
        </Card>

        <SectionTitle>Auto-backup</SectionTitle>
        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.hint}>
            Whenever you make a change, the app also saves your data in the “Cake Customers” folder inside Documents.
            The folder stays even if the app’s data is cleared or the app is reinstalled, and a “Restore backup” button
            then appears on the empty Upcoming and Customers screens.
          </Text>
          <Text style={styles.hint}>
            {BACKUP_LOCATION} ·{' '}
            {backupNeedsAccess
              ? 'not updating — tap “Save backup now” and allow the folder'
              : backupStatus?.fileExists
                ? 'folder present'
                : 'created after your first change'}
          </Text>
          <Button title="Save backup now" icon="save-outline" onPress={saveNow} disabled={backupBusy} />
          <Button
            title="Export a copy to keep"
            icon="share-outline"
            variant="secondary"
            onPress={exportCopy}
            disabled={backupBusy}
          />
          <Button
            title="Restore from file"
            icon="folder-open-outline"
            variant="secondary"
            onPress={restoreFromFile}
            disabled={backupBusy}
          />
        </Card>

        <SectionTitle>Share & paste</SectionTitle>
        <Card style={{ gap: spacing.sm }}>
          <Button title="Export backup" icon="share-outline" variant="secondary" onPress={exportData} />
          <Text style={styles.hint}>Share to WhatsApp, email or notes to keep a copy. To restore, paste it below.</Text>
          <Field
            label="Restore from backup"
            value={importText}
            onChangeText={setImportText}
            placeholder="Paste backup text here"
            multiline
            style={{ minHeight: 60 }}
          />
          <Button title="Restore" icon="download-outline" variant="secondary" onPress={importData} disabled={!importText.trim()} />
        </Card>

        <SectionTitle>Data</SectionTitle>
        <Card style={{ gap: spacing.sm }}>
          <Button title="Add demo customers" icon="sparkles-outline" variant="secondary" onPress={loadSample} />
          <Button title="Delete all data" icon="trash-outline" variant="danger" onPress={clearAll} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: 128 },
  row: { flexDirection: 'row', gap: spacing.md },
  hint: { fontSize: 12, color: colors.muted },
  previewLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  preview: { backgroundColor: '#DCF8C6', borderRadius: 12, padding: spacing.md },
  previewText: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
