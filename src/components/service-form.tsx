import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { formatDuration, OfferedAt, offeredAtOptions } from '../lib/format';
import { spacing } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';
import { useUi } from '../lib/ui';
import { SelectField, SelectOption } from './select-field';

const categories = ['Hair', 'Braids', 'Barbering', 'Nails', 'Makeup'];

const STEP_MINUTES = 15;
const MAX_MINUTES = 12 * 60;

function durationOptions(current: number | null): SelectOption<number>[] {
  const values = Array.from({ length: MAX_MINUTES / STEP_MINUTES }, (_, i) => (i + 1) * STEP_MINUTES);
  if (current && !values.includes(current)) {
    values.push(current);
    values.sort((a, b) => a - b);
  }
  return values.map((m) => ({ value: m, label: formatDuration(m) }));
}

export type ServiceValues = {
  name: string;
  category: string;
  offeredAt: OfferedAt;
  price: number;
  durationMinutes: number;
};

type Props = {
  initial?: ServiceValues;
  submitLabel: string;
  onSubmit: (values: ServiceValues) => Promise<void>;
  children?: ReactNode;
};

export function ServiceForm({ initial, submitLabel, onSubmit, children }: Props) {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<string | null>(initial?.category ?? null);
  const [offeredAt, setOfferedAt] = useState<OfferedAt>(initial?.offeredAt ?? 'at_professional');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [duration, setDuration] = useState<number | null>(initial?.durationMinutes ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);

    const priceNumber = Number(price.replace(',', '.'));

    if (!name.trim()) {
      setError('Give the service a name.');
      return;
    }
    if (!category) {
      setError('Pick a category.');
      return;
    }
    if (!price.trim()) {
      setError('Add a price.');
      return;
    }
    if (isNaN(priceNumber) || priceNumber < 0) {
      setError("That price doesn't look right. Use numbers only, like 250.");
      return;
    }
    if (!duration) {
      setError('Pick how long it takes.');
      return;
    }

    setSaving(true);

    try {
      await onSubmit({
        name: name.trim(),
        category,
        offeredAt,
        price: priceNumber,
        durationMinutes: duration,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={ui.screen} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <Text style={ui.label}>Service name</Text>
        <TextInput
          style={ui.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Gel manicure"
          placeholderTextColor={colors.textFaint}
        />

        <Text style={ui.label}>Category</Text>
        <View style={styles.wrap}>
          {categories.map((c) => (
            <Pressable key={c} style={[ui.chip, category === c && ui.chipSelected]} onPress={() => setCategory(c)}>
              <Text style={[ui.chipText, category === c && ui.chipTextSelected]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={ui.label}>Where do you offer it?</Text>
        <View style={styles.wrap}>
          {offeredAtOptions.map((o) => (
            <Pressable
              key={o.value}
              style={[ui.chip, offeredAt === o.value && ui.chipSelected]}
              onPress={() => setOfferedAt(o.value)}
            >
              <Text style={[ui.chipText, offeredAt === o.value && ui.chipTextSelected]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
        {offeredAt !== 'at_professional' && (
          <Text style={ui.help}>Set your address and call-out fee under House calls if you haven't yet.</Text>
        )}

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={ui.label}>Price (R)</Text>
            <TextInput style={ui.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ui.label}>Duration</Text>
            <SelectField
              value={duration}
              options={durationOptions(initial?.durationMinutes ?? null)}
              onChange={setDuration}
              placeholder="Choose"
              title="How long does it take?"
            />
          </View>
        </View>

        {error && <Text style={ui.error}>{error}</Text>}

        <Pressable style={[ui.button, saving && ui.buttonDisabled]} onPress={handleSubmit} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={ui.buttonText}>{submitLabel}</Text>}
        </Pressable>

        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
}));