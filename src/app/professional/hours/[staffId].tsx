import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../../components/avatar';
import { SelectField, SelectOption } from '../../../components/select-field';
import { Toggle } from '../../../components/toggle';
import { DAY_ORDER, HoursRow, LONG_DAYS, SHORT_DAYS, summarizeHours } from '../../../lib/hours';
import { professionalPhotoUrl } from '../../../lib/photos';
import { supabase } from '../../../lib/supabase';
import { colors, fonts, radius, spacing } from '../../../lib/theme';
import { ui } from '../../../lib/ui';

type DayHours = { day: number; open: boolean; start: string; end: string };
type Teammate = { id: number; name: string; working_hours: HoursRow[] };

const timeOptions: SelectOption<string>[] = Array.from({ length: 48 }, (_, i) => {
  const time = `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`;
  return { value: time, label: time };
});

const DEFAULT_WEEK: DayHours[] = DAY_ORDER.map((day) => ({ day, open: day !== 0, start: '08:00', end: '17:00' }));

function weekFromRows(rows: HoursRow[]): DayHours[] {
  if (rows.length === 0) return DEFAULT_WEEK;
  return DAY_ORDER.map((day) => {
    const row = rows.find((r) => r.day_of_week === day);
    return row
      ? { day, open: true, start: row.start_time.slice(0, 5), end: row.end_time.slice(0, 5) }
      : { day, open: false, start: '08:00', end: '17:00' };
  });
}

function sameTimesEveryDay(week: DayHours[]) {
  const open = week.filter((d) => d.open);
  return open.every((d) => d.start === open[0].start && d.end === open[0].end);
}

export default function MemberHours() {
  const { staffId } = useLocalSearchParams<{ staffId: string }>();

  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [week, setWeek] = useState<DayHours[]>(DEFAULT_WEEK);
  const [simple, setSimple] = useState(true);
  const [simpleStart, setSimpleStart] = useState('08:00');
  const [simpleEnd, setSimpleEnd] = useState('17:00');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyWeek(newWeek: DayHours[]) {
    setWeek(newWeek);
    const firstOpen = newWeek.find((d) => d.open);
    if (sameTimesEveryDay(newWeek)) {
      setSimple(true);
      if (firstOpen) {
        setSimpleStart(firstOpen.start);
        setSimpleEnd(firstOpen.end);
      }
    } else {
      setSimple(false);
    }
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data, error: loadError } = await supabase
        .from('staff')
        .select('id, name, avatar_path, working_hours(day_of_week, start_time, end_time)')
        .eq('professional_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (loadError || !data) {
        setError(loadError?.message ?? 'Could not load hours.');
        setLoading(false);
        return;
      }

      const me = data.find((m) => m.id === Number(staffId));
      if (!me) {
        setError('Team member not found.');
        setLoading(false);
        return;
      }

      setName(me.name);
      setAvatarPath(me.avatar_path);
      applyWeek(weekFromRows(me.working_hours as HoursRow[]));
      setTeammates(
        (data as Teammate[]).filter((m) => m.id !== me.id && m.working_hours.length > 0)
      );
      setLoading(false);
    }

    load();
  }, [staffId]);

  function toggleDay(day: number) {
    setWeek((current) => current.map((d) => (d.day === day ? { ...d, open: !d.open } : d)));
  }

  function updateDay(day: number, changes: Partial<DayHours>) {
    setWeek((current) => current.map((d) => (d.day === day ? { ...d, ...changes } : d)));
  }

  function switchToDetailed() {
    setWeek((current) => current.map((d) => ({ ...d, start: simpleStart, end: simpleEnd })));
    setSimple(false);
  }

  function switchToSimple() {
    const firstOpen = week.find((d) => d.open);
    if (firstOpen) {
      setSimpleStart(firstOpen.start);
      setSimpleEnd(firstOpen.end);
    }
    setSimple(true);
  }

  function copyFrom(teammateId: number) {
    const teammate = teammates.find((t) => t.id === teammateId);
    if (teammate) applyWeek(weekFromRows(teammate.working_hours));
  }

  const finalWeek = simple ? week.map((d) => ({ ...d, start: simpleStart, end: simpleEnd })) : week;
  const openDays = finalWeek.filter((d) => d.open);
  const preview = summarizeHours(
    openDays.map((d) => ({ day_of_week: d.day, start_time: d.start, end_time: d.end }))
  );

  async function handleSave() {
    if (!userId) return;
    setError(null);

    if (openDays.length === 0) {
      setError(`Choose at least one day. If ${name} isn't working at the moment, switch off "Taking bookings" in My team.`);
      return;
    }
    for (const d of openDays) {
      if (d.end <= d.start) {
        setError(`${LONG_DAYS[d.day]}: closing time must be after opening time.`);
        return;
      }
    }

    setSaving(true);
    const id = Number(staffId);
    const closedDays = finalWeek.filter((d) => !d.open).map((d) => d.day);

    if (closedDays.length > 0) {
      const { error: deleteError } = await supabase
        .from('working_hours')
        .delete()
        .eq('staff_id', id)
        .in('day_of_week', closedDays);

      if (deleteError) {
        setError(deleteError.message);
        setSaving(false);
        return;
      }
    }

    const { error: saveError } = await supabase.from('working_hours').upsert(
      openDays.map((d) => ({
        professional_id: userId,
        staff_id: id,
        day_of_week: d.day,
        start_time: d.start,
        end_time: d.end,
      })),
      { onConflict: 'staff_id,day_of_week' }
    );

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

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
      <View style={styles.header}>
        <Avatar name={name || '?'} url={professionalPhotoUrl(avatarPath)} size={56} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerLabel}>Working hours for</Text>
          <Text style={styles.headerName}>{name}</Text>
        </View>
      </View>

      {teammates.length > 0 && (
        <>
          <Text style={ui.label}>Copy hours from</Text>
          <SelectField
            value={null}
            options={teammates.map((t) => ({ value: t.id, label: t.name }))}
            onChange={copyFrom}
            placeholder="Choose a team member"
            title="Copy hours from"
          />
        </>
      )}

      {simple ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Days they work</Text>
          <View style={styles.dayChips}>
            {week.map((d) => (
              <Pressable
                key={d.day}
                style={[styles.dayChip, d.open && styles.dayChipOn]}
                onPress={() => toggleDay(d.day)}
                accessibilityLabel={`${LONG_DAYS[d.day]}, ${d.open ? 'working' : 'off'}`}
              >
                <Text style={[styles.dayChipText, d.open && styles.dayChipTextOn]}>{SHORT_DAYS[d.day]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.cardTitle, { marginTop: spacing.xl }]}>Hours</Text>
          <View style={styles.timesRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.timeLabel}>Opens</Text>
              <SelectField value={simpleStart} options={timeOptions} onChange={setSimpleStart} title="Opens at" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timeLabel}>Closes</Text>
              <SelectField value={simpleEnd} options={timeOptions} onChange={setSimpleEnd} title="Closes at" />
            </View>
          </View>

          <Pressable style={styles.modeLink} onPress={switchToDetailed}>
            <Ionicons name="options-outline" size={16} color={colors.accentDark} />
            <Text style={styles.modeLinkText}>Different hours on some days?</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.list}>
            {week.map((d) => (
              <View key={d.day} style={[styles.dayCard, !d.open && styles.dayCardClosed]}>
                <View style={styles.dayHeader}>
                  <Text style={[styles.dayLabel, !d.open && styles.dayLabelClosed]}>{LONG_DAYS[d.day]}</Text>
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
                        title={`${LONG_DAYS[d.day]}: opens at`}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timeLabel}>Closes</Text>
                      <SelectField
                        value={d.end}
                        options={timeOptions}
                        onChange={(value) => updateDay(d.day, { end: value })}
                        title={`${LONG_DAYS[d.day]}: closes at`}
                      />
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>

          <Pressable style={styles.modeLink} onPress={switchToSimple}>
            <Ionicons name="reorder-two-outline" size={16} color={colors.accentDark} />
            <Text style={styles.modeLinkText}>Use the same hours every day</Text>
          </Pressable>
        </>
      )}

      {preview.length > 0 && (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Customers can book {name}:</Text>
          {preview.map((line) => (
            <Text key={line} style={styles.previewLine}>
              {line}
            </Text>
          ))}
        </View>
      )}

      {error && <Text style={ui.error}>{error}</Text>}

      <Pressable style={[ui.button, saving && ui.buttonDisabled]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={ui.buttonText}>Save {name}'s hours</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  headerLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  headerName: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.lg },
  cardTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, marginBottom: spacing.md },
  dayChips: { flexDirection: 'row', gap: 6 },
  dayChip: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.background },
  dayChipOn: { backgroundColor: colors.accentDark, borderColor: colors.accentDark },
  dayChipText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  dayChipTextOn: { color: colors.onAccent },
  timesRow: { flexDirection: 'row', gap: spacing.md },
  timeLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  modeLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: spacing.lg },
  modeLinkText: { fontFamily: fonts.medium, fontSize: 14, color: colors.accentDark },
  list: { gap: spacing.sm, marginTop: spacing.lg },
  dayCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  dayCardClosed: { backgroundColor: 'transparent' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  dayLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  dayLabelClosed: { color: colors.textMuted },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  status: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  statusOpen: { fontFamily: fonts.medium, color: colors.accentDark },
  preview: { backgroundColor: colors.accentSoft, borderRadius: radius.sm, padding: spacing.md, marginTop: spacing.xl },
  previewTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.accentDark, marginBottom: 4 },
  previewLine: { fontFamily: fonts.regular, fontSize: 15, color: colors.text, marginTop: 2 },
});