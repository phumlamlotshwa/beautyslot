import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MonthCalendar } from '../../../components/month-calendar';
import { BusyTime, getOpenSlots } from '../../../lib/slots';
import { supabase } from '../../../lib/supabase';
import { fonts, radius, spacing } from '../../../lib/theme';
import { makeStyles, useTheme } from '../../../lib/theme-context';
import { useUi } from '../../../lib/ui';

type Hours = { day_of_week: number; start_time: string; end_time: string };

type Booking = {
  id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  requested_starts_at: string | null;
  services: { name: string } | null;
  professionals: { first_name: string } | null;
  staff: { name: string; working_hours: Hours[] } | null;
};

const MINUTE = 60 * 1000;
const MAX_REASON = 300;
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const quickReasons = ['Something came up', 'Running late', 'Not feeling well', 'Clashes with work'];

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDay(date: Date) {
  return `${dayNames[date.getDay()]} ${date.getDate()} ${monthNames[date.getMonth()]}`;
}

export default function ChangeTime() {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const today = new Date();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [booking, setBooking] = useState<Booking | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [monthBusy, setMonthBusy] = useState<BusyTime[]>([]);
  const [availableDays, setAvailableDays] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Date[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const hours = booking?.staff?.working_hours ?? [];
  const duration = booking
    ? Math.round((new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime()) / MINUTE)
    : 0;

  useEffect(() => {
    async function loadBooking() {
      const { data, error: loadError } = await supabase
        .from('bookings')
        .select(
          'id, starts_at, ends_at, status, requested_starts_at, services(name), professionals(first_name), staff(name, working_hours(day_of_week, start_time, end_time))'
        )
        .eq('id', bookingId)
        .single();

      if (loadError || !data) {
        setError(loadError ? "We couldn't load this booking. Go back and try again." : 'This booking no longer exists.');
        setLoading(false);
        return;
      }

      setBooking(data as unknown as Booking);
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

      const { data, error: busyError } = await supabase.rpc('get_change_busy_times', {
        p_booking_id: booking.id,
        p_from: searchFrom.toISOString(),
        p_to: searchTo.toISOString(),
      });

      if (cancelled) return;

      if (busyError) {
        setError("We couldn't load the open times. Check your connection and try again.");
        setLoadingMonth(false);
        return;
      }

      const busy = (data ?? []) as BusyTime[];
      const available = new Set<string>();

      for (let d = new Date(monthStart); d < monthEnd; d.setDate(d.getDate() + 1)) {
        const dayHours = hours.find((h) => h.day_of_week === d.getDay());
        if (!dayHours) continue;

        const openSlots = getOpenSlots(d, dayHours.start_time.slice(0, 5), dayHours.end_time.slice(0, 5), duration, busy);
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
  }, [booking, visibleMonth, refreshKey]);

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
      setError('Add a reason so they know why.');
      return;
    }

    setError(null);
    setSending(true);

    const { error: sendError } = await supabase.rpc('request_booking_change', {
      p_booking_id: booking.id,
      p_starts_at: selectedSlot.toISOString(),
      p_reason: reason.trim(),
    });

    setSending(false);

    if (sendError) {
      if (sendError.code === '23P01') {
        setError('That time was just taken. Pick another one.');
        setSelectedDate(null);
        setSelectedSlot(null);
        setSlots([]);
        setRefreshKey((k) => k + 1);
      } else if (sendError.code === 'P0001') {
        setError(sendError.message);
      } else {
        setError("Your request didn't send. Check your connection and try again.");
      }
      return;
    }

    const name = booking.professionals?.first_name ?? 'They';

    Alert.alert(
      'Request sent',
      `${name} can accept or decline ${formatDay(selectedSlot)} at ${formatTime(selectedSlot)}. Until then, your booking stays at its current time.`,
      [{ text: 'Done', onPress: () => router.back() }]
    );
  }

  if (loading) {
    return (
      <View style={ui.centered}>
        <Stack.Screen options={{ title: 'Change time' }} />
        <ActivityIndicator size="large" color={colors.accentDark} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[ui.screen, ui.content]}>
        <Stack.Screen options={{ title: 'Change time' }} />
        <Text style={ui.error}>{error}</Text>
      </View>
    );
  }

  const currentTime = new Date(booking.starts_at);
  const alreadyAsked = booking.requested_starts_at ? new Date(booking.requested_starts_at) : null;
  const proName = booking.professionals?.first_name ?? 'the professional';

  return (
    <KeyboardAvoidingView
      style={ui.screen}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <Stack.Screen options={{ title: 'Change time' }} />
      <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.serviceName}>{booking.services?.name}</Text>
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

        {alreadyAsked && (
          <View style={styles.notice}>
            <Ionicons name="time-outline" size={16} color={colors.text} />
            <Text style={styles.noticeText}>
              You already asked for {formatDay(alreadyAsked)} at {formatTime(alreadyAsked)}. Sending a new request replaces it.
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

        {selectedSlot && (
          <>
            <Text style={ui.sectionTitle}>Why do you need to change it?</Text>
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
              placeholder="Or write your own"
              placeholderTextColor={colors.textFaint}
              multiline
              maxLength={MAX_REASON}
              textAlignVertical="top"
            />
            <Text style={styles.counter}>
              {reason.length}/{MAX_REASON}
            </Text>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Moving from</Text>
              <Text style={styles.oldTime}>
                {formatDay(currentTime)} at {formatTime(currentTime)}
              </Text>
              <Text style={[styles.summaryLabel, { marginTop: spacing.md }]}>To</Text>
              <Text style={styles.newTime}>
                {formatDay(selectedSlot)} at {formatTime(selectedSlot)}
              </Text>
              <Text style={styles.summaryHelp}>
                Your booking stays at its current time until {proName} accepts. If they decline, nothing changes.
              </Text>

              {error && <Text style={ui.error}>{error}</Text>}

              <Pressable style={[ui.button, sending && ui.buttonDisabled]} onPress={handleSend} disabled={sending}>
                {sending ? <ActivityIndicator color={colors.onAccent} /> : <Text style={ui.buttonText}>Send request</Text>}
              </Pressable>
            </View>
          </>
        )}

        {!selectedSlot && error && <Text style={ui.error}>{error}</Text>}
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
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slotChip: { width: '31%', backgroundColor: colors.surface, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center' },
  slotChipSelected: { backgroundColor: colors.accentDark },
  slotText: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.text },
  slotTextSelected: { color: colors.onAccent },
  reasonChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  reasonInput: { minHeight: 90, paddingTop: 12 },
  counter: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint, textAlign: 'right', marginTop: 4 },
  summaryCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.xl },
  summaryLabel: { fontFamily: fonts.semiBold, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textFaint },
  oldTime: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted, textDecorationLine: 'line-through', marginTop: 2 },
  newTime: { fontFamily: fonts.extraBold, fontSize: 20, color: colors.text, marginTop: 2 },
  summaryHelp: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.md },
}));