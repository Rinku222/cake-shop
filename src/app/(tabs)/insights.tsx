import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, Card, EmptyState, SectionTitle } from '@/components/ui';
import {
  daysBetween,
  formatDate,
  fromISODate,
  isReminded,
  occasionEmoji,
  occasionTitle,
  occurrenceInYear,
  startOfDay,
} from '@/lib/dates';
import { useStore } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const CONVERSION_WINDOW_DAYS = 45;
const MISSED_LOOKBACK_DAYS = 7;

export default function InsightsScreen() {
  const { customers, settings } = useStore();

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const orders = customers.flatMap((c) => c.orders);
    const revenue = orders.reduce((s, o) => s + (o.amount ?? 0), 0);
    const repeat = customers.filter((c) => c.orders.length >= 2).length;

    // A reminder "converted" if the customer ordered for that occasion within N days after being reminded.
    const logs = customers.flatMap((c) => c.contactLog.map((l) => ({ c, l })));
    const converted = logs.filter(({ c, l }) =>
      c.orders.some((o) => {
        if (o.occasionId !== l.occasionId) return false;
        const diff = daysBetween(new Date(l.at), fromISODate(o.date));
        return diff >= 0 && diff <= CONVERSION_WINDOW_DAYS;
      }),
    ).length;

    const remindersThisMonth = logs.filter(({ l }) => {
      const d = new Date(l.at);
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }).length;

    const byMonth = Array(12).fill(0) as number[];
    customers.forEach((c) => c.occasions.forEach((o) => byMonth[o.month - 1]++));

    // Occasions that passed recently without a reminder or an order.
    const missed = customers.flatMap((c) =>
      c.occasions
        .map((o) => {
          // Check last year too, so early-January lookbacks catch late-December occasions.
          const date = [today.getFullYear(), today.getFullYear() - 1]
            .map((y) => occurrenceInYear(o, y))
            .find((d) => {
              const ago = daysBetween(d, today);
              return ago >= 1 && ago <= MISSED_LOOKBACK_DAYS;
            });
          if (!date) return null;
          const ordered = c.orders.some((ord) => ord.occasionId === o.id && fromISODate(ord.date).getFullYear() === date.getFullYear());
          if (ordered || isReminded(c, o.id, date.getFullYear())) return null;
          return { c, o, date };
        })
        .filter((x) => x !== null),
    );

    const topCustomers = customers
      .map((c) => ({ c, spent: c.orders.reduce((s, o) => s + (o.amount ?? 0), 0) }))
      .filter((x) => x.c.orders.length > 0)
      .sort((a, b) => b.spent - a.spent || b.c.orders.length - a.c.orders.length)
      .slice(0, 5);

    return { orders, revenue, repeat, logs, converted, remindersThisMonth, byMonth, missed, topCustomers };
  }, [customers]);

  if (customers.length === 0) {
    return <EmptyState icon="stats-chart-outline" title="No data yet" message="Insights appear once you add customers and orders." />;
  }

  const maxMonth = Math.max(1, ...stats.byMonth);
  const repeatRate = Math.round((stats.repeat / customers.length) * 100);
  const conversionRate = stats.logs.length ? Math.round((stats.converted / stats.logs.length) * 100) : 0;
  const currentMonth = new Date().getMonth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.grid}>
        <Kpi label="Customers" value={String(customers.length)} />
        <Kpi label="Repeat customers" value={`${stats.repeat}`} sub={`${repeatRate}% of all`} />
        <Kpi label="Revenue" value={`${settings.currency}${stats.revenue.toLocaleString()}`} sub={`${stats.orders.length} orders`} />
        <Kpi
          label="Reminder → order"
          value={`${conversionRate}%`}
          sub={`${stats.converted} of ${stats.logs.length} reminders`}
        />
      </View>
      <Text style={styles.footnote}>
        {stats.remindersThisMonth} reminder{stats.remindersThisMonth === 1 ? '' : 's'} sent this month. A reminder counts as
        converted when an order for that occasion follows within {CONVERSION_WINDOW_DAYS} days.
      </Text>

      {stats.missed.length > 0 && (
        <>
          <SectionTitle>Missed in the last {MISSED_LOOKBACK_DAYS} days</SectionTitle>
          <Card>
            {stats.missed.map(({ c, o, date }) => (
                <Pressable
                  key={`${c.id}-${o.id}`}
                  style={styles.listRow}
                  onPress={() => router.push({ pathname: '/customer/[id]', params: { id: c.id } })}
                >
                  <Text style={styles.listMain}>
                    {occasionEmoji(o)} {c.name} — {o.forWhom ? `${o.forWhom}'s ` : ''}
                    {occasionTitle(o)}
                  </Text>
                  <Text style={styles.listSub}>{formatDate(date)}</Text>
                </Pressable>
            ))}
            <Text style={styles.footnote}>Not reminded and no order. A belated wish can still win the next order!</Text>
          </Card>
        </>
      )}

      <SectionTitle>Occasions by month</SectionTitle>
      <Card>
        <View style={styles.chart}>
          {stats.byMonth.map((n, i) => (
            <View key={i} style={styles.barCol}>
              <Text style={styles.barValue}>{n || ''}</Text>
              <View
                style={[
                  styles.bar,
                  { height: Math.max(4, (n / maxMonth) * 100) },
                  i === currentMonth && { backgroundColor: colors.primaryDark },
                ]}
              />
              <Text style={[styles.barLabel, i === currentMonth && { color: colors.primary, fontWeight: '700' }]}>{MONTHS[i]}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footnote}>Plan stock and staff for your busiest months.</Text>
      </Card>

      {stats.topCustomers.length > 0 && (
        <>
          <SectionTitle>Top customers</SectionTitle>
          <Card>
            {stats.topCustomers.map(({ c, spent }, i) => (
                <Pressable
                  key={c.id}
                  style={[styles.listRow, styles.topRow]}
                  onPress={() => router.push({ pathname: '/customer/[id]', params: { id: c.id } })}
                >
                  <Text style={styles.rank}>{i + 1}</Text>
                  <Avatar name={c.name} size={32} />
                  <Text style={[styles.listMain, { flex: 1 }]}>{c.name}</Text>
                  <Text style={styles.listSub}>
                    {c.orders.length} · {settings.currency}
                    {spent.toLocaleString()}
                  </Text>
                </Pressable>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {sub && <Text style={styles.kpiSub}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: 48 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpi: {
    width: '48.5%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.lg,
  },
  kpiValue: { fontSize: 24, fontWeight: '800', color: colors.primaryDark },
  kpiLabel: { fontSize: 13, color: colors.text, fontWeight: '600', marginTop: 4 },
  kpiSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  footnote: { fontSize: 12, color: colors.muted, marginTop: spacing.sm },
  listRow: { paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  listMain: { fontSize: 14, color: colors.text, fontWeight: '500' },
  listSub: { fontSize: 12, color: colors.muted },
  rank: { width: 16, fontWeight: '700', color: colors.muted },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 4 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '70%', backgroundColor: colors.primary, borderRadius: 4 },
  barValue: { fontSize: 10, color: colors.muted, marginBottom: 2 },
  barLabel: { fontSize: 11, color: colors.muted, marginTop: 4 },
});
