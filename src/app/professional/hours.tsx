import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Toggle } from '../../components/toggle';
import { SelectField, SelectOption } from '../../components/select-field';
import { supabase } from '../../lib/supabase';
import { colors, fonts, radius, spacing } from '../../lib/theme';
import { ui } from '../../lib/ui';

type DayHours = {
  day: number;
  label: string;
  open: boolean;
  start: string;
  end: string;
};

const defaultWeek: DayHours[] = [
  { day: 1, label: 'Monday', open: true, start: '08:00', end: '17:00' },
  { day: 2, label: 'Tuesday', open: true, start: '08:00', end: '17:00' },
  { day: 3, label: 'Wednesday', open: true, start: '08:00', end: '17:00' },
  { day: 4, label: 'Thursday', open: true, start: '08:00', end: '17:00' },
  { day: 5, label: 'Friday', open: true, start: '08:00', end: '17:00' },
  { day: 6, label: 'Saturday', open: true, start: '08:00', end: '17:00' },
  { day: 0, label: 'Sunday', open: false, start: '08:00', end: '17:00' },
];

const timeOptions: SelectOption<string>[] = Array.from({ length: 48 }, (_, i) => {
  const time = `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`;
  return { value: time, label: time };
});

export default function WorkingHours() {
  const [week, setWeek] = useState<DayHours[]>(defaultWeek);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHours() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error: loadError } = await supabase
        .from('working_hours')
        .select('day_of_week, start_time, end_time')
        .eq('professional_id', user.id);

      if (loadError) {
        setError(loadError.message);
      } else if (data && data.length > 0) {
        setWeek(
          defaultWeek.map((d) => {
            const saved = data.find((row) => row.day_of_week === d.day);
            return saved
              ? { ...d, open: true, start: saved.start_time.slice(0, 5), end: saved.end_time.slice(0, 5) }
              : { ...d, open: false };
          })
        );
      }

      setLoading(false);
    }

    loadHours();
  }, []);

  function updateDay(day: number, changes: Partial<DayHours>) {
    setWeek((current) => current.map((d) => (d.day === day ? { ...d, ...changes } : d)));
  }

  async function handleSave() {
    setError(null);

    const openDays = week.filter((d) => d.open);

    for (const d of openDays) {
      if (d.end <= d.start) {
        setError(`${d.label}: closing time must be after opening time.`);
        return;
      }
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('You need to be logged in to save your hours.');
      setSaving(false);
      return;
    }

    const closedDays = week.filter((d) => !d.open).map((d) => d.day);

    if (closedDays.length > 0) {
      const { error: deleteError } = await supabase
        .from('working_hours')
        .delete()
        .eq('professional_id', user.id)
        .in('day_of_week', closedDays);

      if (deleteError) {
        setError(deleteError.message);
        setSaving(false);
        return;
      }
    }

    if (openDays.length > 0) {
      const { error: saveError } = await supabase.from('working_hours').upsert(
        openDays.map((d) => ({
          professional_id: user.id,
          day_of_week: d.day,
          start_time: d.start,
          end_time: d.end,
        })),
        { onConflict: 'professional_id,day_of_week' }
      );

      if (saveError) {
        setError(saveError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    router.back();
  }

  if (loading) {
    return (
      <View style={ui.centered}>
        <ActivityIndicator size="large" color={colors.accentDark} />
      </View>
    );
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Text style={ui.muted}>Choose the days you work and your hours. Customers can only book within these times.</Text>

      <View style={styles.list}>
        {week.map((d) => (
          <View key={d.day} style={[styles.dayCard, !d.open && styles.dayCardClosed]}>
            <View style={styles.dayHeader}>
              <Text style={[styles.dayLabel, !d.open && styles.dayLabelClosed]}>{d.label}</Text>
              <View style={styles.switchRow}>
                <Text style={[styles.status, d.open && styles.statusOpen]}>{d.open ? 'Open' : 'Closed'}</Text>
                <Toggle value={d.open} onValueChange={(value) => updateDay(d.day, { open: value })} />
              </View>
            </View>

            {d.open && (
              <View style={styles.timesRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timeLabel}>Opens</Text>
                  <SelectField
                    value={d.start}
                    options={timeOptions}
                    onChange={(value) => updateDay(d.day, { start: value })}
                    title={`${d.label}: opens at`}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timeLabel}>Closes</Text>
                  <SelectField
                    value={d.end}
                    options={timeOptions}
                    onChange={(value) => updateDay(d.day, { end: value })}
                    title={`${d.label}: closes at`}
                  />
                </View>
              </View>
            )}
          </View>
        ))}
      </View>

      {error && <Text style={ui.error}>{error}</Text>}

      <Pressable style={[ui.button, saving && ui.buttonDisabled]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={ui.buttonText}>Save hours</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, marginTop: spacing.lg },
  dayCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  dayCardClosed: { backgroundColor: 'transparent' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  dayLabelClosed: { color: colors.textMuted },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  status: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  statusOpen: { fontFamily: fonts.medium, color: colors.accentDark },
  timesRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  timeLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginBottom: 4 },
});