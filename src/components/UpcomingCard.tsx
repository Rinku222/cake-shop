import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Badge, Button } from './ui';
import { formatDate, formatWeekday, milestoneText, occasionEmoji, occasionTitle, relativeDays, UpcomingItem } from '@/lib/dates';
import { buildReminderMessage, openSms, openWhatsApp } from '@/lib/messaging';
import { useStore } from '@/lib/store';
import { colors, radius, spacing } from '@/lib/theme';

export function UpcomingCard({ item }: { item: UpcomingItem }) {
  const { settings, logContact, undoContact } = useStore();
  const { customer, occasion, date, daysAway, reminded } = item;
  const milestone = milestoneText(occasion, date);
  const lastOrder = customer.orders[0];
  const year = date.getFullYear();

  const sendWhatsApp = async () => {
    const opened = await openWhatsApp(customer.phone, buildReminderMessage(customer, occasion, date, settings), settings);
    if (opened) logContact(customer.id, { occasionId: occasion.id, year, channel: 'whatsapp' });
  };

  const sendSms = async () => {
    const opened = await openSms(customer.phone, buildReminderMessage(customer, occasion, date, settings));
    if (opened) logContact(customer.id, { occasionId: occasion.id, year, channel: 'sms' });
  };

  const urgency = daysAway === 0 ? colors.primary : daysAway <= 3 ? colors.warning : colors.border;

  return (
      <Pressable
        style={({ pressed }) => [styles.card, { borderLeftColor: urgency }, pressed && { opacity: 0.85 }]}
        onPress={() => router.push({ pathname: '/customer/[id]', params: { id: customer.id } })}
      >
        <View style={styles.top}>
          <Avatar name={customer.name} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {customer.name}
            </Text>
            <Text style={styles.occasion} numberOfLines={1}>
              {occasionEmoji(occasion)} {occasion.forWhom ? `${occasion.forWhom}'s ` : ''}
              {occasionTitle(occasion)}
              {milestone ? ` · ${milestone}` : ''}
            </Text>
          </View>
          <View style={styles.when}>
            <Text style={[styles.relative, daysAway === 0 && { color: colors.primary }]}>{relativeDays(daysAway)}</Text>
            <Text style={styles.date}>
              {formatWeekday(date)}, {formatDate(date)}
            </Text>
          </View>
        </View>

        {lastOrder && (
          <Text style={styles.lastOrder} numberOfLines={1}>
            Last order: {lastOrder.cake}
            {lastOrder.flavor ? ` (${lastOrder.flavor})` : ''}
          </Text>
        )}

        <View style={styles.actions}>
          {reminded ? <Badge label="✓ Reminded" tone="success" /> : <Badge label="Not reminded yet" tone="warning" />}
          <View style={{ flex: 1 }} />
          {reminded ? (
            <Button title="Undo" variant="ghost" compact onPress={() => undoContact(customer.id, occasion.id, year)} />
          ) : (
            <Button
              title="Mark done"
              variant="ghost"
              compact
              onPress={() => logContact(customer.id, { occasionId: occasion.id, year, channel: 'manual' })}
            />
          )}
        </View>

        <View style={styles.send}>
          <Button title="SMS" icon="chatbubble-ellipses" variant="sms" compact onPress={sendSms} style={styles.sendButton} />
          <Button title="WhatsApp" icon="logo-whatsapp" variant="whatsapp" compact onPress={sendWhatsApp} style={styles.sendButton} />
        </View>
      </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  occasion: { fontSize: 13, color: colors.muted, marginTop: 2 },
  when: { alignItems: 'flex-end' },
  relative: { fontSize: 14, fontWeight: '700', color: colors.text },
  date: { fontSize: 11, color: colors.muted, marginTop: 2 },
  lastOrder: { fontSize: 12, color: colors.muted, fontStyle: 'italic' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  send: { flexDirection: 'row', gap: spacing.sm },
  sendButton: { flex: 1 },
});
