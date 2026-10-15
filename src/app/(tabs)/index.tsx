import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from 'react-native';
import { UpcomingCard } from '@/components/UpcomingCard';
import { Button, Chip, EmptyState } from '@/components/ui';
import { getUpcoming, UpcomingItem } from '@/lib/dates';
import { buildSampleCustomers } from '@/lib/sampleData';
import { useStore } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';

const WINDOWS = [7, 15, 30];

type Filter = 'all' | 'pending';

export default function UpcomingScreen() {
  const { customers, settings, loaded, updateSettings, replaceAll } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const windowDays = settings.upcomingWindowDays;

  const sections = useMemo(() => {
    const items = getUpcoming(customers, windowDays).filter((i) => filter === 'all' || !i.reminded);
    const groups: { title: string; data: UpcomingItem[] }[] = [
      { title: 'Today', data: items.filter((i) => i.daysAway === 0) },
      { title: 'Next 7 days', data: items.filter((i) => i.daysAway >= 1 && i.daysAway <= 7) },
      { title: 'Later', data: items.filter((i) => i.daysAway > 7) },
    ];
    return groups.filter((g) => g.data.length > 0);
  }, [customers, windowDays, filter]);

  const total = sections.reduce((n, s) => n + s.data.length, 0);

  if (!loaded) return <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />;

  return (
    <SectionList
      sections={sections}
      keyExtractor={(i) => `${i.customer.id}-${i.occasion.id}`}
      contentContainerStyle={styles.container}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <View style={{ gap: spacing.sm }}>
          <View style={styles.chips}>
            {WINDOWS.map((d) => (
              <Chip
                key={d}
                label={`${d} days`}
                selected={windowDays === d}
                onPress={() => updateSettings({ upcomingWindowDays: d })}
              />
            ))}
            <View style={styles.divider} />
            <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label="To remind" selected={filter === 'pending'} onPress={() => setFilter('pending')} />
          </View>
          <Text style={styles.summary}>
            {total} occasion{total === 1 ? '' : 's'} in the next {windowDays} days
          </Text>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>
          {section.title} · {section.data.length}
        </Text>
      )}
      renderItem={({ item }) => <UpcomingCard item={item} />}
      ListEmptyComponent={
        customers.length === 0 ? (
          <EmptyState
            icon="gift-outline"
            title="No customers yet"
            message="Add a customer with their birthday or anniversary and it will show up here before the date."
            action={
              <View style={{ gap: spacing.sm, alignSelf: 'stretch' }}>
                <Button title="Add first customer" icon="person-add" onPress={() => router.push('/add')} />
                <Button
                  title="Try with demo data"
                  icon="sparkles-outline"
                  variant="secondary"
                  onPress={() => replaceAll({ customers: buildSampleCustomers(), settings })}
                />
              </View>
            }
          />
        ) : (
          <EmptyState
            icon="checkmark-circle-outline"
            title={filter === 'pending' ? 'All caught up!' : 'Nothing coming up'}
            message={
              filter === 'pending'
                ? 'Every upcoming customer has been reminded.'
                : `No occasions in the next ${windowDays} days. Try a longer window.`
            }
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  divider: { width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: 2 },
  summary: { color: colors.muted, fontSize: 13 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
});
