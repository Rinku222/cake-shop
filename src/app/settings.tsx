import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Field, SectionTitle } from '@/components/ui';
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
  createdAt: '',
};

export default function SettingsScreen() {
  const { settings, updateSettings, customers, replaceAll } = useStore();
  const [importText, setImportText] = useState('');

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

        <SectionTitle>Backup</SectionTitle>
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
