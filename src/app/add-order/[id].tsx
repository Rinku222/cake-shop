import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { DateField } from '@/components/DateField';
import { Button, Card, Chip, EmptyState, Field, SectionTitle } from '@/components/ui';
import { daysBetween, nextOccurrence, occasionEmoji, occasionTitle, occurrenceInYear, toISODate } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { spacing } from '@/lib/theme';
import { Customer } from '@/lib/types';

/** Pick the occasion closest to the order date (within a week either side), if any. */
function guessOccasion(customer: Customer, date: Date): string | undefined {
  let best: { id: string; diff: number } | undefined;
  for (const o of customer.occasions) {
    const candidates = [date.getFullYear() - 1, date.getFullYear(), date.getFullYear() + 1].map((y) => occurrenceInYear(o, y));
    for (const c of candidates) {
      const diff = Math.abs(daysBetween(date, c));
      if (diff <= 7 && (!best || diff < best.diff)) best = { id: o.id, diff };
    }
  }
  return best?.id;
}

export default function AddOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCustomer, addOrder, settings } = useStore();
  const customer = getCustomer(id);

  const [date, setDate] = useState(new Date());
  const [cake, setCake] = useState('');
  const [flavor, setFlavor] = useState(customer?.favoriteFlavor ?? '');
  const [weight, setWeight] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [occasionId, setOccasionId] = useState<string | undefined>(() =>
    customer ? guessOccasion(customer, new Date()) : undefined,
  );

  if (!customer) {
    return <EmptyState icon="person-outline" title="Customer not found" message="This customer may have been deleted." />;
  }

  const save = () => {
    if (!cake.trim()) return Alert.alert('Cake required', 'What did they order?');
    addOrder(customer.id, {
      date: toISODate(date),
      cake: cake.trim(),
      flavor: flavor.trim() || undefined,
      weightKg: parseFloat(weight) || undefined,
      amount: parseFloat(amount) || undefined,
      notes: notes.trim() || undefined,
      occasionId,
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card>
          <Field label="Cake *" value={cake} onChangeText={setCake} placeholder="e.g. Photo cake, 2-tier" autoFocus />
          <Field label="Flavour" value={flavor} onChangeText={setFlavor} placeholder="e.g. Butterscotch" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="1" />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label={`Amount (${settings.currency})`}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="800"
              />
            </View>
          </View>
          <DateField
            label="Order date"
            value={date}
            maximumDate={new Date()}
            onChange={(d) => {
              setDate(d);
              setOccasionId(guessOccasion(customer, d));
            }}
          />
          <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Message on cake, delivery time…" multiline />
        </Card>

        {customer.occasions.length > 0 && (
          <>
            <SectionTitle>For occasion</SectionTitle>
            <View style={styles.chips}>
              <Chip label="None" selected={!occasionId} onPress={() => setOccasionId(undefined)} />
              {[...customer.occasions]
                .sort((a, b) => nextOccurrence(a).getTime() - nextOccurrence(b).getTime())
                .map((o) => (
                  <Chip
                    key={o.id}
                    label={`${occasionEmoji(o)} ${o.forWhom ? `${o.forWhom}'s ` : ''}${occasionTitle(o)}`}
                    selected={occasionId === o.id}
                    onPress={() => setOccasionId(o.id)}
                  />
                ))}
            </View>
          </>
        )}

        <Button title="Save order" icon="checkmark" onPress={save} style={{ marginTop: spacing.xl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: 48 },
  row: { flexDirection: 'row', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
