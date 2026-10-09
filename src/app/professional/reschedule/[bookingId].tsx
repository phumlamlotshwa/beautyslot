import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MonthCalendar } from '../../../components/month-calendar';
import { BusyTime, getOpenSlots } from '../../../lib/slots';
import { supabase } from '../../../lib/supabase';
import { fonts, radius, spacing } from '../../../lib/theme';
import { makeStyles, useTheme } from '../../../lib/theme-context';
import { useUi } from '../../../lib/ui';

type Booking = {
  id: number;
  professional_id: string;
  starts_at: string;
  status: string;
  previous_starts_at: string | null;
  requested_starts_at: string | null;
  travel_minutes: number;
  services: { name: string; duration_minutes: number } | null;
  customers: { first_name: string } | null;
  staff_id: number;
  staff: { name: string } | null;
};

type Hours = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

const MINUTE = 60 * 1000;
const quickReasons = ['Fully booked', 'Not feeling well', 'Something came up'];
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDay(date: Date) {
  return `${dayNames[date.getDay()]} ${date.getDate()} ${monthNames[date.getMonth()]}`;
}

export default function SuggestNewTime() {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const today = new Date();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [booking, setBooking] = useState<Booking | null>(null);
  const [hours, setHours] = useState<Hours[]>([]);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [monthBusy, setMonthBusy] = useState<BusyTime[]>([]);
  const [availableDays, setAvailableDays] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Date[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const duration = booking?.services?.duration_minutes ?? 0;

  useEffect(() => {
    async function loadBooking() {
      const { data, error: loadError } = await supabase
        .from('bookings')
        .select(
          'id, professional_id, staff_id, staff(name), starts_at, status, previous_starts_at, requested_starts_at, travel_minutes, services(name, duration_minutes), customers(first_name)',
        )
        .eq('id', bookingId)
        .single();

      if (loadError || !data) {
        setError(
          loadError ? "We couldn't load this booking. Go back and try again." : 'This booking no longer exists.',
        );
        setLoading(false);
        return;
      }

      const typed = data as unknown as Booking;

      const { data: hoursData } = await supabase
        .from('working_hours')
        .select('day_of_week, start_time, end_time')
        .eq('staff_id', typed.staff_id);

      setBooking(typed);
      setHours(hoursData ?? []);
      setLoading(false);
    }

    loadBooking();
  }, [bookingId]);

  useEffect(() => {
    if (!booking) return;

    let cancelled = false;

    async function loadMonth() {
      if (!booking) return;

      setLoadingMonth(true);

      const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
      const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
      const searchFrom = new Date(monthStart.getTime() - 24 * 60 * MINUTE);
      const searchTo = new Date(monthEnd.getTime() + 24 * 60 * MINUTE);

      const { data, error: busyError } = await supabase
        .from('bookings')
        .select('starts_at, ends_at, travel_minutes')
        .eq('staff_id', booking.staff_id)
        .in('status', ['pending', 'confirmed', 'reschedule_proposed'])
        .neq('id', booking.id)
        .lt('starts_at', searchTo.toISOString())
        .gt('ends_at', searchFrom.toISOString());

      if (cancelled) return;

      if (busyError) {
        setError("We couldn't load the open times. Check your connection and try again.");
        setLoadingMonth(false);
        return;
      }

      const busy: BusyTime[] = (data ?? []).map((b) => {
        const gap = (b.travel_minutes + booking.travel_minutes) * MINUTE;
        return {
          starts_at: new Date(new Date(b.starts_at).getTime() - gap).toISOString(),
          ends_at: new Date(new Date(b.ends_at).getTime() + gap).toISOString(),
        };
      });

      const available = new Set<string>();

      for (let d = new Date(monthStart); d < monthEnd; d.setDate(d.getDate() + 1)) {
        const dayHours = hours.find((h) => h.day_of_week === d.getDay());
        if (!dayHours) continue;

        const openSlots = getOpenSlots(
          d,
          dayHours.start_time.slice(0, 5),
          dayHours.end_time.slice(0, 5),
          duration,
          busy,
        );
        if (openSlots.length > 0) available.add(d.toDateString());
      }

      setMonthBusy(busy);
      setAvailableDays(available);
      setLoadingMonth(false);
    }

    loadMonth();

    return () => {
      cancelled = true;
    };
  }, [booking, hours, visibleMonth, refreshKey]);

  function changeMonth(month: Date) {
    setVisibleMonth(month);
    setSelectedDate(null);
    setSelectedSlot(null);
    setSlots([]);
    setError(null);
  }

  function selectDate(date: Date) {
    setSelectedDate(date);
    setSelectedSlot(null);
    setError(null);

    const dayHours = hours.find((h) => h.day_of_week === date.getDay());

    if (!dayHours) {
      setSlots([]);
      return;
    }

    setSlots(getOpenSlots(date, dayHours.start_time.slice(0, 5), dayHours.end_time.slice(0, 5), duration, monthBusy));
  }

  async function handleSend() {
    if (!booking || !selectedSlot) return;

    if (reason.trim() === '') {
      setError('Let them know why you need to move it.');
      return;
    }

    setError(null);
    setSaving(true);

    const endsAt = new Date(selectedSlot.getTime() + duration * MINUTE);
    const originalTime =
      booking.status === 'reschedule_proposed' && booking.previous_starts_at
        ? booking.previous_starts_at
        : booking.starts_at;

    const { error: saveError } = await supabase
      .from('bookings')
      .update({
        starts_at: selectedSlot.toISOString(),
        ends_at: endsAt.toISOString(),
        status: 'reschedule_proposed',
        previous_starts_at: originalTime,
        change_reason: reason.trim(),
        requested_starts_at: null,
        requested_ends_at: null,
      })
      .eq('id', booking.id);

    setSaving(false);

    if (saveError) {
      if (saveError.code === '23P01') {
        setError('That time was just taken. Pick another one.');
        setSelectedDate(null);
        setSelectedSlot(null);
        setSlots([]);
        setRefreshKey((k) => k + 1);
      } else {
        setError("Couldn't send that. Check your connection and try again.");
      }
      return;
    }

    const name = booking.customers?.first_name ?? 'They';

    Alert.alert('Sent', `${name} can accept or decline it.`, [{ text: 'OK', onPress: () => router.back() }]);
  }

  if (loading) {
    return (
      <View style={ui.centered}>
        <ActivityIndicator size="large" color={colors.accentDark} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[ui.screen, ui.content]}>
        <Text style={ui.error}>{error}</Text>
      </View>
    );
  }

  const currentTime = new Date(booking.starts_at);
  const customerName = booking.customers?.first_name ?? 'the customer';
  const theyAsked = booking.requested_starts_at ? new Date(booking.requested_starts_at) : null;

  return (
    <KeyboardAvoidingView style={ui.screen} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.serviceName}>{booking.services?.name}</Text>
          <View style={styles.line}>
            <Ionicons name="person-outline" size={15} color={colors.textMuted} />
            <Text style={styles.lineText}>{booking.customers?.first_name}</Text>
          </View>
          {booking.staff?.name ? (
            <View style={styles.line}>
              <Ionicons name="cut-outline" size={15} color={colors.textMuted} />
              <Text style={styles.lineText}>With {booking.staff.name}</Text>
            </View>
          ) : null}
          <View style={styles.line}>
            <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
            <Text style={styles.lineText}>
              Booked for {formatDay(currentTime)} at {formatTime(currentTime)}
            </Text>
          </View>
        </View>

        {theyAsked && (
          <View style={styles.notice}>
            <Ionicons name="time-outline" size={16} color={colors.text} />
            <Text style={styles.noticeText}>
              {customerName} asked for {formatDay(theyAsked)} at {formatTime(theyAsked)}. A new time from you will
              replace it.
            </Text>
          </View>
        )}

        <Text style={ui.sectionTitle}>Pick a new day</Text>
        <MonthCalendar
          month={visibleMonth}
          minMonth={thisMonth}
          selectedDate={selectedDate}
          isAvailable={(date) => !loadingMonth && availableDays.has(date.toDateString())}
          onSelectDate={selectDate}
          onChangeMonth={changeMonth}
        />
        {loadingMonth && <ActivityIndicator style={{ marginTop: spacing.sm }} color={colors.accentDark} />}

        {selectedDate && (
          <>
            <Text style={ui.sectionTitle}>Times on {formatDay(selectedDate)}</Text>
            {slots.length === 0 ? (
              <Text style={ui.muted}>This day is fully booked. Try another day.</Text>
            ) : (
              <View style={styles.slotGrid}>
                {slots.map((slot) => {
                  const isSelected = selectedSlot?.getTime() === slot.getTime();
                  return (
                    <Pressable
                      key={slot.getTime()}
                      style={[styles.slotChip, isSelected && styles.slotChipSelected]}
                      onPress={() => setSelectedSlot(slot)}
                    >
                      <Text style={[styles.slotText, isSelected && styles.slotTextSelected]}>{formatTime(slot)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}

        {!selectedSlot && error && <Text style={ui.error}>{error}</Text>}

        {selectedSlot && (
          <>
            <Text style={ui.sectionTitle}>Reason</Text>
            <View style={styles.reasonChips}>
              {quickReasons.map((r) => {
                const isSelected = reason === r;
                return (
                  <Pressable key={r} style={[ui.chip, isSelected && ui.chipSelected]} onPress={() => setReason(r)}>
                    <Text style={[ui.chipText, isSelected && ui.chipTextSelected]}>{r}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              style={[ui.input, styles.reasonInput]}
              value={reason}
              onChangeText={setReason}
              placeholder="Or type it here"
              placeholderTextColor={colors.textFaint}
              multiline
              maxLength={300}
              textAlignVertical="top"
            />

            <View style={styles.summaryCard}>
              <Text style={styles.oldTime}>
                {formatDay(currentTime)} at {formatTime(currentTime)}
              </Text>
              <View style={styles.newTimeRow}>
                <Ionicons name="arrow-forward" size={18} color={colors.text} />
                <Text style={styles.newTime}>
                  {formatDay(selectedSlot)} at {formatTime(selectedSlot)}
                </Text>
              </View>
              <Text style={styles.summaryHelp}>If {customerName} says no, the booking is cancelled.</Text>
              {error && <Text style={ui.error}>{error}</Text>}
              <Pressable style={[ui.button, saving && ui.buttonDisabled]} onPress={handleSend} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={colors.onAccent} />
                ) : (
                  <Text style={ui.buttonText}>Send new time</Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg },
  serviceName: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginBottom: spacing.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  lineText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  noticeText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text },
  reasonChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  reasonInput: { minHeight: 90, paddingTop: 12 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slotChip: {
    width: '31%',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  slotChipSelected: { backgroundColor: colors.accentDark },
  slotText: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.text },
  slotTextSelected: { color: colors.onAccent },
  summaryCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginTop: 28 },
  oldTime: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted, textDecorationLine: 'line-through' },
  newTimeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  newTime: { flex: 1, fontFamily: fonts.extraBold, fontSize: 20, color: colors.text },
  summaryHelp: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
}));