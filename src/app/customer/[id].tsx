import { Ionicons } from '@expo/vector-icons';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, Badge, Button, Card, EmptyState, IconButton, SectionTitle } from '@/components/ui';
import {
  daysBetween,
  formatDate,
  formatDayMonth,
  fromISODate,
  isReminded,
  milestoneText,
  nextOccurrence,
  occasionEmoji,
  occasionTitle,
  relativeDays,
} from '@/lib/dates';
import { buildReminderMessage, callPhone, openSms, openWhatsApp } from '@/lib/messaging';
import { useStore } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';
import { Occasion } from '@/lib/types';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCustomer, settings, logContact, undoContact, deleteCustomer, deleteOrder } = useStore();
  const customer = getCustomer(id);

  if (!customer) {
    return <EmptyState icon="person-outline" title="Customer not found" message="This customer may have been deleted." />;
  }

  const totalSpent = customer.orders.reduce((s, o) => s + (o.amount ?? 0), 0);
  const lastOrder = customer.orders[0];
  const occasionsSorted = [...customer.occasions].sort(
    (a, b) => nextOccurrence(a).getTime() - nextOccurrence(b).getTime(),
  );

  const remind = async (o: Occasion, via: 'whatsapp' | 'sms') => {
    const date = nextOccurrence(o);
    const message = buildReminderMessage(customer, o, date, settings);
    const opened = via === 'whatsapp' ? await openWhatsApp(customer.phone, message, settings) : await openSms(customer.phone, message);
    if (opened) logContact(customer.id, { occasionId: o.id, year: date.getFullYear(), channel: via });
  };

  const confirmDelete = () =>
    Alert.alert('Delete customer?', `${customer.name} and all their orders will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          router.back();
          deleteCustomer(customer.id);
        },
      },
    ]);

  const confirmDeleteOrder = (orderId: string) =>
    Alert.alert('Delete order?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteOrder(customer.id, orderId) },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: customer.name,
          headerRight: () => (
            <Link href={{ pathname: '/customer/edit/[id]', params: { id: customer.id } }} asChild>
              <Pressable hitSlop={10} accessibilityLabel="Edit customer">
                <Ionicons name="create-outline" size={22} color={colors.primary} />
              </Pressable>
            </Link>
          ),
        }}
      />

      <Card style={styles.profile}>
        <Avatar name={customer.name} size={64} />
        <Text style={styles.name}>{customer.name}</Text>
        <Text style={styles.phone}>{customer.phone}</Text>
        {customer.email && <Text style={styles.muted}>{customer.email}</Text>}
        <View style={styles.contactRow}>
          <IconButton icon="call" label="Call" onPress={() => callPhone(customer.phone)} />
          <IconButton
            icon="logo-whatsapp"
            label="WhatsApp"
            color={colors.whatsapp}
            onPress={() => openWhatsApp(customer.phone, `Hi ${customer.name.split(' ')[0]}! `, settings)}
          />
          <IconButton icon="chatbubble-ellipses" label="SMS" onPress={() => openSms(customer.phone, '')} />
        </View>
      </Card>

      <View style={styles.stats}>
        <Stat label="Orders" value={String(customer.orders.length)} />
        <Stat label="Total spent" value={`${settings.currency}${totalSpent.toLocaleString()}`} />
        <Stat label="Last order" value={lastOrder ? formatDate(fromISODate(lastOrder.date)) : '—'} />
      </View>

      {(customer.favoriteFlavor || customer.notes) && (
        <Card>
          {customer.favoriteFlavor && (
            <Text style={styles.detailLine}>
              <Text style={styles.bold}>Favourite flavour: </Text>
              {customer.favoriteFlavor}
            </Text>
          )}
          {customer.notes && (
            <Text style={styles.detailLine}>
              <Text style={styles.bold}>Notes: </Text>
              {customer.notes}
            </Text>
          )}
        </Card>
      )}

      <SectionTitle>Occasions</SectionTitle>
      {occasionsSorted.map((o) => {
        const next = nextOccurrence(o);
        const days = daysBetween(new Date(), next);
        const reminded = isReminded(customer, o.id, next.getFullYear());
        const milestone = milestoneText(o, next);
        return (
          <Card key={o.id}>
            <View style={styles.occasionTop}>
              <Text style={styles.emoji}>{occasionEmoji(o)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.occasionTitle}>
                  {o.forWhom ? `${o.forWhom}'s ` : ''}
                  {occasionTitle(o)}
                </Text>
                <Text style={styles.muted}>
                  {formatDayMonth(o.day, o.month)}
                  {o.year ? ` ${o.year}` : ''}
                  {milestone ? ` · ${milestone}` : ''}
                </Text>
              </View>
              <Badge label={relativeDays(days)} tone={days <= settings.upcomingWindowDays ? 'primary' : 'muted'} />
            </View>
            <View style={styles.occasionActions}>
              {reminded ? (
                <Pressable onPress={() => undoContact(customer.id, o.id, next.getFullYear())}>
                  <Badge label={`✓ Reminded for ${next.getFullYear()} (tap to undo)`} tone="success" />
                </Pressable>
              ) : (
                <Button
                  title="Mark reminded"
                  variant="ghost"
                  compact
                  onPress={() => logContact(customer.id, { occasionId: o.id, year: next.getFullYear(), channel: 'manual' })}
                />
              )}
              <View style={{ flex: 1 }} />
              <IconButton icon="chatbubble-ellipses" label="Send SMS reminder" onPress={() => remind(o, 'sms')} />
              <Button title="Remind" icon="logo-whatsapp" variant="whatsapp" compact onPress={() => remind(o, 'whatsapp')} />
            </View>
          </Card>
        );
      })}

      <SectionTitle
        right={
          <Button
            title="Add order"
            icon="add"
            variant="ghost"
            compact
            onPress={() => router.push({ pathname: '/add-order/[id]', params: { id: customer.id } })}
          />
        }
      >
        Order history
      </SectionTitle>
      {customer.orders.length === 0 ? (
        <Text style={styles.muted}>No orders yet.</Text>
      ) : (
        customer.orders.map((order) => {
          const occasion = customer.occasions.find((o) => o.id === order.occasionId);
          return (
            <Pressable key={order.id} onLongPress={() => confirmDeleteOrder(order.id)}>
              <Card style={styles.order}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderCake}>
                    {order.cake}
                    {order.weightKg ? ` · ${order.weightKg} kg` : ''}
                  </Text>
                  <Text style={styles.muted}>
                    {formatDate(fromISODate(order.date))}
                    {order.flavor ? ` · ${order.flavor}` : ''}
                    {occasion ? ` · ${occasionEmoji(occasion)} ${occasionTitle(occasion)}` : ''}
                  </Text>
                  {order.notes && <Text style={styles.muted}>{order.notes}</Text>}
                </View>
                {order.amount != null && (
                  <Text style={styles.amount}>
                    {settings.currency}
                    {order.amount.toLocaleString()}
                  </Text>
                )}
              </Card>
            </Pressable>
          );
        })
      )}
      {customer.orders.length > 0 && <Text style={[styles.muted, { textAlign: 'center' }]}>Long-press an order to delete it</Text>}

      <Button title="Delete customer" icon="trash-outline" variant="danger" onPress={confirmDelete} style={{ marginTop: spacing.xl }} />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: 48 },
  profile: { alignItems: 'center', gap: 4 },
  name: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  phone: { fontSize: 15, color: colors.text },
  contactRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  stat: {
    flex: 1,
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.primaryDark },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  detailLine: { fontSize: 14, color: colors.text, marginBottom: 4 },
  bold: { fontWeight: '700' },
  muted: { fontSize: 12, color: colors.muted, marginTop: 2 },
  occasionTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emoji: { fontSize: 28 },
  occasionTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  occasionActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  order: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  orderCake: { fontSize: 15, fontWeight: '600', color: colors.text },
  amount: { fontSize: 15, fontWeight: '700', color: colors.success },
});
