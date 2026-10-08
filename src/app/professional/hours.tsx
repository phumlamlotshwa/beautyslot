import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { TimeSelect } from '../../components/time-select';
import { supabase } from '../../lib/supabase';

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
      <View style={[styles.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>Choose the days you work and your hours. Customers can only book within these times.</Text>

      {week.map((d) => (
        <View key={d.day} style={styles.dayRow}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayLabel}>{d.label}</Text>
            <View style={styles.switchRow}>
              <Text style={styles.status}>{d.open ? 'Open' : 'Closed'}</Text>
              <Switch
                value={d.open}
                onValueChange={(value) => updateDay(d.day, { open: value })}
                trackColor={{ true: '#000000', false: '#cccccc' }}
              />
            </View>
          </View>

          {d.open && (
            <View style={styles.timesRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.timeLabel}>Opens</Text>
                <TimeSelect value={d.start} onChange={(value) => updateDay(d.day, { start: value })} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.timeLabel}>Closes</Text>
                <TimeSelect value={d.end} onChange={(value) => updateDay(d.day, { end: value })} />
              </View>
            </View>
          )}
        </View>
      ))}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.button, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Save hours</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 24, paddingBottom: 48 },
  intro: { fontSize: 15, color: '#666666', marginBottom: 16 },
  dayRow: { borderBottomWidth: 1, borderBottomColor: '#eeeeee', paddingVertical: 12 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayLabel: { fontSize: 16, fontWeight: '600', color: '#000000' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { fontSize: 14, color: '#666666' },
  timesRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  timeLabel: { fontSize: 13, color: '#666666', marginBottom: 4 },
  error: { color: '#c62828', marginTop: 16 },
  button: { backgroundColor: '#000000', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 24 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});