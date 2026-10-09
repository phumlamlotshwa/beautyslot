import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/avatar';
import { SelectField, SelectOption } from '../../components/select-field';
import { Toggle } from '../../components/toggle';
import { professionalPhotoUrl } from '../../lib/photos';
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

type Member = { id: number; name: string; avatar_path: string | null };

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
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [staffId, setStaffId] = useState<number | null>(null);
  const [week, setWeek] = useState<DayHours[]>(defaultWeek);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingHours, setLoadingHours] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTeam() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data } = await supabase
        .from('staff')
        .select('id, name, avatar_path')
        .eq('professional_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      const team = data ?? [];
      setMembers(team);
      if (team.length > 0) setStaffId(team[0].id);
      setLoading(false);
    }

    loadTeam();
  }, []);

  useEffect(() => {
    if (staffId === null) return;

    let cancelled = false;

    async function loadHours() {
      setLoadingHours(true);
      setError(null);
      setSaved(false);

      const { data, error: loadError } = await supabase
        .from('working_hours')
        .select('day_of_week, start_time, end_time')
        .eq('staff_id', staffId!);

      if (cancelled) return;

      if (loadError) {
        setError(loadError.message);
      } else if (data && data.length > 0) {
        setWeek(
          defaultWeek.map((d) => {
            const row = data.find((r) => r.day_of_week === d.day);
            return row
              ? { ...d, open: true, start: row.start_time.slice(0, 5), end: row.end_time.slice(0, 5) }
              : { ...d, open: false };
          })
        );
      } else {
        setWeek(defaultWeek);
      }

      setDirty(false);
      setLoadingHours(false);
    }

    loadHours();

    return () => {
      cancelled = true;
    };
  }, [staffId]);

  function updateDay(day: number, changes: Partial<DayHours>) {
    setWeek((current) => current.map((d) => (d.day === day ? { ...d, ...changes } : d)));
    setDirty(true);
    setSaved(false);
  }

  function switchMember(id: number) {
    if (id === staffId) return;

    if (!dirty) {
      setStaffId(id);
      return;
    }

    Alert.alert('Discard changes?', "You haven't saved this person's hours.", [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => setStaffId(id) },
    ]);
  }

  async function handleSave() {
    if (!userId || staffId === null) return;
    setError(null);
    setSaved(false);

    const openDays = week.filter((d) => d.open);

    for (const d of openDays) {
      if (d.end <= d.start) {
        setError(`${d.label}: closing time must be after opening time.`);
        return;
      }
    }

    setSaving(true);

    const closedDays = week.filter((d) => !d.open).map((d) => d.day);

    if (closedDays.length > 0) {
      const { error: deleteError } = await supabase
        .from('working_hours')
        .delete()
        .eq('staff_id', staffId)
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
          professional_id: userId,
          staff_id: staffId,
          day_of_week: d.day,
          start_time: d.start,
          end_time: d.end,
        })),
        { onConflict: 'staff_id,day_of_week' }
      );

      if (saveError) {
        setError(saveError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setDirty(false);
    setSaved(true);
  }

  if (loading) {
    return (
      <View style={ui.centered}>
        <ActivityIndicator size="large" color={colors.accentDark} />
      </View>
    );
  }

  const current = members.find((m) => m.id === staffId);

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      {members.length > 1 && (
        <>
          <Text style={ui.label}>Whose hours?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberRow}>
            {members.map((m) => {
              const selected = m.id === staffId;
              return (
                <Pressable
                  key={m.id}
                  style={[styles.memberChip, selected && styles.memberChipSelected]}
                  onPress={() => switchMember(m.id)}
                >
                  <Avatar name={m.name} url={professionalPhotoUrl(m.avatar_path)} size={28} />
                  <Text style={[styles.memberName, selected && styles.memberNameSelected]}>{m.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      <Text style={[ui.muted, { marginTop: spacing.md }]}>
        {members.length > 1 && current
          ? `Choose the days ${current.name} works. Customers can only book them within these times.`
          : 'Choose the days you work and your hours. Customers can only book within these times.'}
      </Text>

      {loadingHours ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.accentDark} />
      ) : (
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
      )}

      {error && <Text style={ui.error}>{error}</Text>}

      {saved && (
        <View style={styles.savedRow}>
          <Ionicons name="checkmark-circle" size={18} color={colors.accentDark} />
          <Text style={styles.savedText}>Hours saved</Text>
        </View>
      )}

      <Pressable
        style={[ui.button, (saving || loadingHours) && ui.buttonDisabled]}
        onPress={handleSave}
        disabled={saving || loadingHours}
      >
        {saving ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={ui.buttonText}>
            {members.length > 1 && current ? `Save ${current.name}'s hours` : 'Save hours'}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  memberRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  memberChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 6, paddingLeft: 6, paddingRight: spacing.lg },
  memberChipSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accentDark },
  memberName: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  memberNameSelected: { color: colors.accentDark },
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
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.lg },
  savedText: { fontFamily: fonts.medium, fontSize: 15, color: colors.accentDark },
});