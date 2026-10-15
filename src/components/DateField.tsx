import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatDate, fromISODate, toISODate } from '@/lib/dates';
import { colors, radius, spacing } from '@/lib/theme';

/** Cross-platform date input: native picker on iOS/Android, plain yyyy-mm-dd text on web. */
export function DateField({
  label,
  value,
  onChange,
  maximumDate,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  maximumDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  const [webText, setWebText] = useState(toISODate(value));

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === 'web' ? (
        <TextInput
          style={styles.input}
          value={webText}
          placeholder="yyyy-mm-dd"
          onChangeText={(t) => {
            setWebText(t);
            if (/^\d{4}-\d{2}-\d{2}$/.test(t)) onChange(fromISODate(t));
          }}
        />
      ) : Platform.OS === 'ios' ? (
        <View style={styles.iosRow}>
          <DateTimePicker
            value={value}
            mode="date"
            display="compact"
            maximumDate={maximumDate}
            accentColor={colors.primary}
            onValueChange={(_, d) => onChange(d)}
          />
        </View>
      ) : (
        <>
          <Pressable style={[styles.input, styles.androidButton]} onPress={() => setOpen(true)}>
            <Text style={styles.value}>{formatDate(value)}</Text>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          </Pressable>
          {open && (
            <DateTimePicker
              value={value}
              mode="date"
              maximumDate={maximumDate}
              onValueChange={(_, d) => {
                setOpen(false);
                onChange(d);
              }}
              onDismiss={() => setOpen(false)}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
  },
  androidButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  value: { fontSize: 15, color: colors.text },
  iosRow: { alignItems: 'flex-start' },
});
