import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, EmptyState } from '@/components/ui';
import { buildFeedbackMessage, openSms, openWhatsApp } from '@/lib/messaging';
import { useStore } from '@/lib/store';
import { colors, radius, spacing } from '@/lib/theme';
import { Customer } from '@/lib/types';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function recentCustomers(customers: Customer[]): Customer[] {
  const cutoff = Date.now() - THREE_DAYS_MS;
  return customers.filter((c) => new Date(c.createdAt).getTime() >= cutoff);
}

function FeedbackCard({ customer }: { customer: Customer }) {
  const { settings, logFeedback, undoFeedback } = useStore();
  const notified = (customer.feedbackLog ?? []).length > 0;

  const msg = buildFeedbackMessage(customer.name, settings.shopName, settings.reviewUrl);

  const sendWhatsApp = async () => {
    const opened = await openWhatsApp(customer.phone, msg, settings);
    if (opened) logFeedback(customer.id, 'whatsapp');
  };

  const sendSms = async () => {
    const opened = await openSms(customer.phone, msg);
    if (opened) logFeedback(customer.id, 'sms');
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      onPress={() => router.push({ pathname: '/customer/[id]', params: { id: customer.id } })}
    >
      <View style={styles.row}>
        <Avatar name={customer.name} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{customer.name}</Text>
          <Text style={styles.sub} numberOfLines={1}>{customer.phone}</Text>
        </View>
        {notified && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✓ Sent</Text>
          </View>
        )}
      </View>
      <View style={styles.actions}>
        {notified ? (
          <Button title="Undo" variant="ghost" compact onPress={() => undoFeedback(customer.id)} />
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={{ flex: 1 }} />
        <Button title="" icon="chatbubble-outline" variant="sms" compact onPress={sendSms} />
        <Button title="" icon="logo-whatsapp" variant="whatsapp" compact onPress={sendWhatsApp} />
      </View>
    </Pressable>
  );
}

export default function FeedbackTab() {
  const { customers } = useStore();
  const [tab, setTab] = useState<'pending' | 'notified'>('pending');

  const recent = recentCustomers(customers);
  const pending = recent.filter((c) => (c.feedbackLog ?? []).length === 0);
  const notified = recent.filter((c) => (c.feedbackLog ?? []).length > 0);
  const list = tab === 'pending' ? pending : notified;

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tabBtn, tab === 'pending' && styles.tabBtnActive]}
          onPress={() => setTab('pending')}
        >
          <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>
            To Notify {pending.length > 0 ? `(${pending.length})` : ''}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, tab === 'notified' && styles.tabBtnActive]}
          onPress={() => setTab('notified')}
        >
          <Text style={[styles.tabText, tab === 'notified' && styles.tabTextActive]}>
            Notified {notified.length > 0 ? `(${notified.length})` : ''}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {list.length === 0 ? (
          <EmptyState
            icon="star-outline"
            title={tab === 'pending' ? 'All caught up!' : 'None yet'}
            message={
              tab === 'pending'
                ? 'No new customers in the last 3 days to notify.'
                : 'Send a feedback request to see customers here.'
            }
          />
        ) : (
          list.map((c) => <FeedbackCard key={c.id} customer={c} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: colors.primary },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.success },
});
