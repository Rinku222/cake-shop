import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { DateField } from './DateField';
import { Avatar, Badge, Button, Card, Chip, Field, IconButton, SectionTitle } from './ui';
import { occurrenceInYear, toISODate } from '@/lib/dates';
import { normalizePhone, uid, useStore } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';
import { Customer, Occasion, OCCASION_TYPES, OccasionType, Order } from '@/lib/types';

export type CustomerFormValues = Omit<Customer, 'id' | 'createdAt' | 'contactLog' | 'feedbackLog'>;

interface OccasionDraft {
  id: string;
  type: OccasionType;
  label: string;
  forWhom: string;
  date: Date;
  yearKnown: boolean;
}

function toDraft(o: Occasion): OccasionDraft {
  return {
    id: o.id,
    type: o.type,
    label: o.label ?? '',
    forWhom: o.forWhom ?? '',
    date: occurrenceInYear(o, o.year ?? new Date().getFullYear()),
    yearKnown: !!o.year,
  };
}

function newDraft(type: OccasionType = 'birthday'): OccasionDraft {
  return { id: uid(), type, label: '', forWhom: '', date: new Date(), yearKnown: false };
}

export function CustomerForm({
  initial,
  submitLabel,
  allowFirstOrder,
  onSubmit,
}: {
  initial?: Customer;
  submitLabel: string;
  /** Shows a "record today's order" section, used when creating a customer at the counter. */
  allowFirstOrder?: boolean;
  onSubmit: (values: CustomerFormValues) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [favoriteFlavor, setFavoriteFlavor] = useState(initial?.favoriteFlavor ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [occasions, setOccasions] = useState<OccasionDraft[]>(
    initial ? initial.occasions.map(toDraft) : [newDraft('birthday')],
  );

  const [withOrder, setWithOrder] = useState(true);
  const [cake, setCake] = useState('');
  const [weight, setWeight] = useState('');
  const [amount, setAmount] = useState('');

  const { findCustomersByPhone, settings } = useStore();

  // Customers whose phone already matches what's being typed. The customer being
  // edited is excluded so editing their own details never flags a false duplicate.
  const existingMatches = useMemo(() => {
    if (normalizePhone(phone).length < 7) return [];
    return findCustomersByPhone(phone, initial?.id);
  }, [phone, findCustomersByPhone, initial?.id]);

  const updateOccasion = (id: string, patch: Partial<OccasionDraft>) =>
    setOccasions((list) => list.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const submit = () => {
    if (!name.trim()) return Alert.alert('Name required', 'Please enter the customer name.');
    if (phone.replace(/\D/g, '').length < 7) return Alert.alert('Phone required', 'Please enter a valid phone number.');
    if (occasions.length === 0) return Alert.alert('Add an occasion', 'Add at least one occasion to get reminders.');
    if (occasions.some((o) => o.type === 'other' && !o.label.trim()))
      return Alert.alert('Occasion name', 'Please name each "Other" occasion.');

    if (existingMatches.length > 0) {
      const match = existingMatches[0];
      Alert.alert(
        'Existing customer found',
        `${match.name} is already saved with this phone number (${match.orders.length} order${
          match.orders.length === 1 ? '' : 's'
        }). Creating a new entry will split their order history.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'View existing',
            onPress: () => router.push({ pathname: '/customer/[id]', params: { id: match.id } }),
          },
          { text: 'Create anyway', style: 'destructive', onPress: doSubmit },
        ],
      );
      return;
    }

    doSubmit();
  };

  const doSubmit = () => {
    const finalOccasions: Occasion[] = occasions.map((o) => ({
      id: o.id,
      type: o.type,
      label: o.type === 'other' ? o.label.trim() : undefined,
      forWhom: o.forWhom.trim() || undefined,
      day: o.date.getDate(),
      month: o.date.getMonth() + 1,
      year: o.yearKnown ? o.date.getFullYear() : undefined,
    }));

    const orders: Order[] = initial?.orders ?? [];
    const newOrders: Order[] =
      allowFirstOrder && withOrder && cake.trim()
        ? [
            {
              id: uid(),
              date: toISODate(new Date()),
              occasionId: finalOccasions[0]?.id,
              cake: cake.trim(),
              flavor: favoriteFlavor.trim() || undefined,
              weightKg: parseFloat(weight) || undefined,
              amount: parseFloat(amount) || undefined,
            },
          ]
        : [];

    onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      favoriteFlavor: favoriteFlavor.trim() || undefined,
      notes: notes.trim() || undefined,
      occasions: finalOccasions,
      orders: [...newOrders, ...orders],
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <SectionTitle>Customer</SectionTitle>
        <Card>
          <Field label="Name *" value={name} onChangeText={setName} placeholder="e.g. Priya Sharma" />
          <Field
            label="Phone (WhatsApp) *"
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g. 98765 43210"
            keyboardType="phone-pad"
          />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="optional"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="Favourite flavour"
            value={favoriteFlavor}
            onChangeText={setFavoriteFlavor}
            placeholder="e.g. Chocolate truffle"
          />
          <Field
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Allergies, eggless, delivery address…"
            multiline
            style={{ minHeight: 70, textAlignVertical: 'top' }}
          />
        </Card>

        {existingMatches.length > 0 && (
          <Card style={styles.duplicateCard}>
            <View style={styles.duplicateHeader}>
              <Ionicons name="warning" size={20} color={colors.warning} />
              <Text style={styles.duplicateTitle}>Phone number already saved</Text>
            </View>
            <Text style={styles.muted}>
              {existingMatches.length === 1
                ? 'This looks like an existing customer. Adding a new entry may split their order history.'
                : 'Multiple customers match this number. Adding a new entry may split their history.'}
            </Text>
            {existingMatches.map((c) => {
              const spent = c.orders.reduce((s, o) => s + (o.amount ?? 0), 0);
              return (
                <View key={c.id} style={styles.duplicateRow}>
                  <Avatar name={c.name} size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.duplicateName}>{c.name}</Text>
                    <Text style={styles.muted}>
                      {c.phone} · {c.orders.length} order{c.orders.length === 1 ? '' : 's'}
                      {spent > 0 ? ` · ${settings.currency}${spent.toLocaleString()}` : ''}
                    </Text>
                  </View>
                  {c.orders.length >= 2 && <Badge label="Repeat customer" tone="success" />}
                </View>
              );
            })}
            <Button
              title="View existing customer"
              icon="eye"
              variant="secondary"
              compact
              style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
              onPress={() => router.push({ pathname: '/customer/[id]', params: { id: existingMatches[0].id } })}
            />
          </Card>
        )}

        <SectionTitle
          right={
            <Button title="Add" icon="add" variant="ghost" compact onPress={() => setOccasions((l) => [...l, newDraft('anniversary')])} />
          }
        >
          Occasions
        </SectionTitle>
        {occasions.map((o, i) => (
          <Card key={o.id}>
            <View style={styles.occasionHeader}>
              <Text style={styles.occasionIndex}>Occasion {i + 1}</Text>
              <IconButton
                icon="trash-outline"
                color={colors.danger}
                label="Remove occasion"
                onPress={() => setOccasions((l) => l.filter((x) => x.id !== o.id))}
              />
            </View>
            <View style={styles.chips}>
              {OCCASION_TYPES.map((t) => (
                <Chip
                  key={t.value}
                  label={`${t.emoji} ${t.label}`}
                  selected={o.type === t.value}
                  onPress={() => updateOccasion(o.id, { type: t.value })}
                />
              ))}
            </View>
            {o.type === 'other' && (
              <Field
                label="Occasion name *"
                value={o.label}
                onChangeText={(label) => updateOccasion(o.id, { label })}
                placeholder="e.g. Graduation, Baby shower"
              />
            )}
            <Field
              label="For whom"
              value={o.forWhom}
              onChangeText={(forWhom) => updateOccasion(o.id, { forWhom })}
              placeholder="Leave blank if it's the customer's own"
              hint="e.g. Son Aarav, Wife Neha, Mom"
            />
            <DateField label="Date" value={o.date} onChange={(date) => updateOccasion(o.id, { date })} />
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Year is accurate</Text>
                <Text style={styles.switchHint}>Enables “Turns 30” / “10th anniversary” in reminders</Text>
              </View>
              <Switch
                value={o.yearKnown}
                onValueChange={(yearKnown) => updateOccasion(o.id, { yearKnown })}
                trackColor={{ true: colors.primary }}
              />
            </View>
          </Card>
        ))}
        {occasions.length === 0 && <Text style={styles.muted}>No occasions yet — tap “Add”.</Text>}

        {allowFirstOrder && (
          <>
            <SectionTitle>Today’s order</SectionTitle>
            <Card>
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { flex: 1 }]}>Record an order placed today</Text>
                <Switch value={withOrder} onValueChange={setWithOrder} trackColor={{ true: colors.primary }} />
              </View>
              {withOrder && (
                <View style={{ marginTop: spacing.md }}>
                  <Field label="Cake" value={cake} onChangeText={setCake} placeholder="e.g. Black forest, 2-tier" />
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Field label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="1" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="800" />
                    </View>
                  </View>
                  <Text style={styles.muted}>Linked to the first occasion above. Leave “Cake” empty to skip.</Text>
                </View>
              )}
            </Card>
          </>
        )}

        <Button title={submitLabel} icon="checkmark" onPress={submit} style={{ marginTop: spacing.md }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: 128 },
  occasionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  occasionIndex: { fontWeight: '700', color: colors.text, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  switchHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
  row: { flexDirection: 'row', gap: spacing.md },
  muted: { color: colors.muted, fontSize: 12 },
  duplicateCard: { borderColor: colors.warning, backgroundColor: colors.warningSoft },
  duplicateHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  duplicateTitle: { fontSize: 15, fontWeight: '700', color: colors.warning, flex: 1 },
  duplicateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  duplicateName: { fontSize: 14, fontWeight: '600', color: colors.text },
});
