import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { RestoreBackupButton } from '@/components/RestoreBackupButton';
import { Avatar, Badge, Button, Chip, EmptyState } from '@/components/ui';
import { daysBetween, nextOccurrence, occasionEmoji, relativeDays } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { colors, radius, spacing } from '@/lib/theme';
import { Customer } from '@/lib/types';

type Sort = 'name' | 'next' | 'orders';

function nextOccasion(c: Customer) {
  let best: { days: number; emoji: string } | undefined;
  for (const o of c.occasions) {
    const days = daysBetween(new Date(), nextOccurrence(o));
    if (!best || days < best.days) best = { days, emoji: occasionEmoji(o) };
  }
  return best;
}

export default function CustomersScreen() {
  const { customers, settings } = useStore();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('next');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return customers
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          (digits.length > 0 && c.phone.replace(/\D/g, '').includes(digits)),
      )
      .map((c) => ({ customer: c, next: nextOccasion(c) }))
      .sort((a, b) => {
        if (sort === 'name') return a.customer.name.localeCompare(b.customer.name);
        if (sort === 'orders') return b.customer.orders.length - a.customer.orders.length;
        return (a.next?.days ?? 999) - (b.next?.days ?? 999);
      });
  }, [customers, query, sort]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.customer.id}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name or phone"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              clearButtonMode="while-editing"
            />
          </View>
          <View style={styles.chips}>
            <Chip label="Next occasion" selected={sort === 'next'} onPress={() => setSort('next')} />
            <Chip label="Name" selected={sort === 'name'} onPress={() => setSort('name')} />
            <Chip label="Most orders" selected={sort === 'orders'} onPress={() => setSort('orders')} />
          </View>
        </View>
      }
      renderItem={({ item: { customer, next } }) => {
        const spent = customer.orders.reduce((s, o) => s + (o.amount ?? 0), 0);
        return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
              onPress={() => router.push({ pathname: '/customer/[id]', params: { id: customer.id } })}
            >
              <Avatar name={customer.name} />
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {customer.name}
                  </Text>
                  {customer.orders.length >= 2 && <Badge label="Repeat" tone="success" />}
                </View>
                <Text style={styles.meta}>
                  {customer.phone} · {customer.orders.length} order{customer.orders.length === 1 ? '' : 's'}
                  {spent > 0 ? ` · ${settings.currency}${spent.toLocaleString()}` : ''}
                </Text>
              </View>
              {next && (
                <Text style={[styles.next, next.days <= settings.upcomingWindowDays && { color: colors.primary }]}>
                  {next.emoji} {relativeDays(next.days)}
                </Text>
              )}
            </Pressable>
        );
      }}
      ListEmptyComponent={
        customers.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No customers yet"
            message="Customers you add will be listed here."
            action={
              <View style={{ gap: spacing.sm, alignSelf: 'stretch' }}>
                <Button title="Add customer" icon="person-add" onPress={() => router.push('/add')} />
                <RestoreBackupButton />
              </View>
            }
          />
        ) : (
          <EmptyState icon="search" title="No matches" message={`Nobody matches “${query}”.`} />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: 48 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  next: { fontSize: 12, fontWeight: '600', color: colors.muted },
});
