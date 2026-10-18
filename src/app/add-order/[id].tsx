import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { DateField } from '@/components/DateField';
import { Button, Card, Chip, EmptyState, Field, SectionTitle } from '@/components/ui';
import { daysBetween, nextOccurrence, occasionEmoji, occasionTitle, occurrenceInYear, toISODate } from '@/lib/dates';
import { uid, useStore } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';
import { Customer, Occasion, OCCASION_TYPES, OccasionType } from '@/lib/types';

/** Chip value for "this order is for an occasion that isn't saved yet". */
const NEW_OCCASION = 'new';

interface NewOccasionDraft {
  type: OccasionType;
  label: string;
  forWhom: string;
  date: Date;
  yearKnown: boolean;
}

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
  const { getCustomer, addOrder, updateCustomer, settings } = useStore();
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
  // A new occasion to save with this order (e.g. their son's birthday). Its date follows the
  // order date until the user picks one, so next year's reminder lands on the same day.
  const [draft, setDraft] = useState<NewOccasionDraft>({
    type: 'birthday',
    label: '',
    forWhom: '',
    date: new Date(),
    yearKnown: false,
  });
  const [draftDateTouched, setDraftDateTouched] = useState(false);
  const updateDraft = (patch: Partial<NewOccasionDraft>) => setDraft((d) => ({ ...d, ...patch }));

  if (!customer) {
    return <EmptyState icon="person-outline" title="Customer not found" message="This customer may have been deleted." />;
  }

  const save = () => {
    if (!cake.trim()) return Alert.alert('Cake required', 'What did they order?');

    let linkedOccasionId = occasionId;
    if (occasionId === NEW_OCCASION) {
      if (draft.type === 'other' && !draft.label.trim()) {
        return Alert.alert('Occasion name required', 'What is the occasion? e.g. Graduation, Baby shower');
      }
      const occasion: Occasion = {
        id: uid(),
        type: draft.type,
        label: draft.type === 'other' ? draft.label.trim() : undefined,
        forWhom: draft.forWhom.trim() || undefined,
        day: draft.date.getDate(),
        month: draft.date.getMonth() + 1,
        year: draft.yearKnown ? draft.date.getFullYear() : undefined,
      };
      // Reuse an identical saved occasion instead of creating a duplicate reminder.
      const same = customer.occasions.find(
        (o) =>
          o.type === occasion.type &&
          o.day === occasion.day &&
          o.month === occasion.month &&
          (o.forWhom ?? '').toLowerCase() === (occasion.forWhom ?? '').toLowerCase() &&
          (o.label ?? '').toLowerCase() === (occasion.label ?? '').toLowerCase(),
      );
      if (same) {
        linkedOccasionId = same.id;
      } else {
        updateCustomer(customer.id, { occasions: [...customer.occasions, occasion] });
        linkedOccasionId = occasion.id;
      }
    }

    addOrder(customer.id, {
      date: toISODate(date),
      cake: cake.trim(),
      flavor: flavor.trim() || undefined,
      weightKg: parseFloat(weight) || undefined,
      amount: parseFloat(amount) || undefined,
      notes: notes.trim() || undefined,
      occasionId: linkedOccasionId,
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
            onChange={(d) => {
              setDate(d);
              if (occasionId !== NEW_OCCASION) setOccasionId(guessOccasion(customer, d));
              if (!draftDateTouched) updateDraft({ date: d });
            }}
          />
          <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Message on cake, delivery time…" multiline />
        </Card>

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
          <Chip label="+ New occasion" selected={occasionId === NEW_OCCASION} onPress={() => setOccasionId(NEW_OCCASION)} />
        </View>

        {occasionId === NEW_OCCASION && (
          <Card style={{ marginTop: spacing.md }}>
            <View style={styles.chips}>
              {OCCASION_TYPES.map((t) => (
                <Chip
                  key={t.value}
                  label={`${t.emoji} ${t.label}`}
                  selected={draft.type === t.value}
                  onPress={() => updateDraft({ type: t.value })}
                />
              ))}
            </View>
            {draft.type === 'other' && (
              <Field
                label="Occasion name *"
                value={draft.label}
                onChangeText={(label) => updateDraft({ label })}
                placeholder="e.g. Graduation, Baby shower"
                style={{ marginTop: spacing.md }}
              />
            )}
            <Field
              label="For whom"
              value={draft.forWhom}
              onChangeText={(forWhom) => updateDraft({ forWhom })}
              placeholder="Leave blank if it's the customer's own"
              hint="e.g. Son Aarav, Wife Neha, Mom"
            />
            <DateField
              label="Occasion date"
              value={draft.date}
              onChange={(d) => {
                setDraftDateTouched(true);
                updateDraft({ date: d });
              }}
            />
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Year is accurate</Text>
                <Text style={styles.switchHint}>Enables “Turns 30” / “10th anniversary” in reminders</Text>
              </View>
              <Switch
                value={draft.yearKnown}
                onValueChange={(yearKnown) => updateDraft({ yearKnown })}
                trackColor={{ true: colors.primary }}
              />
            </View>
            <Text style={styles.switchHint}>Saved to {customer.name.split(' ')[0]}’s occasions — you’ll be reminded every year.</Text>
          </Card>
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
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  switchHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
