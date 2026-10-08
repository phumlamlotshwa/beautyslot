import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MonthCalendar } from '../../../components/month-calendar';
import { BusyTime, getOpenSlots } from '../../../lib/slots';
import { supabase } from '../../../lib/supabase';

type Booking = {
  id: number;
  professional_id: string;
  starts_at: string;
  status: string;
  previous_starts_at: string | null;
  travel_minutes: number;
  services: { name: string; duration_minutes: number } | null;
  customers: { first_name: string } | null;
};

type Hours = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

const MINUTE = 60 * 1000;
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDay(date: Date) {
  return `${dayNames[date.getDay()]} ${date.getDate()} ${monthNames[date.getMonth()]}`;
}

export default function SuggestNewTime() {
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
        .select('id, professional_id, starts_at, status, previous_starts_at, travel_minutes, services(name, duration_minutes), customers(first_name)')
        .eq('id', bookingId)
        .single();

      if (loadError || !data) {
        setError(loadError?.message ?? 'Booking not found.');
        setLoading(false);
        return;
      }

      const typed = data as unknown as Booking;

      const { data: hoursData } = await supabase
        .from('working_hours')
        .select('day_of_week, start_time, end_time')
        .eq('professional_id', typed.professional_id);

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
        .eq('professional_id', booking.professional_id)
        .in('status', ['pending', 'confirmed', 'reschedule_proposed'])
        .neq('id', booking.id)
        .lt('starts_at', searchTo.toISOString())
        .gt('ends_at', searchFrom.toISOString());

      if (cancelled) return;

      if (busyError) {
        setError(busyError.message);
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
      })
      .eq('id', booking.id);

    setSaving(false);

    if (saveError) {
      if (saveError.code === '23P01') {
        setError('That time was just taken. Please choose another.');
        setSelectedDate(null);
        setSelectedSlot(null);
        setSlots([]);
        setRefreshKey((k) => k + 1);
      } else {
        setError(saveError.message);
      }
      return;
    }

    Alert.alert(
      'New time sent',
      `${booking.customers?.first_name ?? 'The customer'} will be asked to accept ${formatDay(selectedSlot)} at ${formatTime(selectedSlot)}.`,
      [{ text: 'OK', onPress: () => router.back() }]
    );
  }

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  const currentTime = new Date(booking.starts_at);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.serviceName}>{booking.services?.name}</Text>
        <Text style={styles.details}>with {booking.customers?.first_name}</Text>
        <Text style={styles.details}>
          Currently {formatDay(currentTime)} at {formatTime(currentTime)}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Choose a new date</Text>
      <MonthCalendar
        month={visibleMonth}
        minMonth={thisMonth}
        selectedDate={selectedDate}
        isAvailable={(date) => !loadingMonth && availableDays.has(date.toDateString())}
        onSelectDate={selectDate}
        onChangeMonth={changeMonth}
      />
      {loadingMonth && <ActivityIndicator style={{ marginTop: 8 }} color="#000000" />}

      {selectedDate && (
        <>
          <Text style={styles.sectionTitle}>Times on {formatDay(selectedDate)}</Text>
          {slots.length === 0 ? (
            <Text style={styles.message}>No open times on this day.</Text>
          ) : (
            <View style={styles.slotGrid}>
              {slots.map((slot) => {
                const isSelected = selectedSlot?.getTime() === slot.getTime();
                return (
                  <Pressable
                    key={slot.getTime()}
                    style={[styles.slotChip, isSelected && styles.chipSelected]}
                    onPress={() => setSelectedSlot(slot)}
                  >
                    <Text style={[styles.slotText, isSelected && styles.textSelected]}>{formatTime(slot)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {selectedSlot && (
        <View style={styles.confirmBox}>
          <Text style={styles.summary}>
            Suggest {formatDay(selectedSlot)} at {formatTime(selectedSlot)}
          </Text>
          <Text style={styles.help}>
            The booking moves to this time straight away. If the customer declines, it will be cancelled.
          </Text>
          <Pressable style={[styles.button, saving && styles.buttonDisabled]} onPress={handleSend} disabled={saving}>
            {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Send new time</Text>}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 24, paddingBottom: 48 },
  card: { borderWidth: 1, borderColor: '#eeeeee', borderRadius: 12, padding: 16 },
  serviceName: { fontSize: 18, fontWeight: '700', color: '#000000' },
  details: { fontSize: 14, color: '#666666', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000000', marginTop: 28, marginBottom: 12 },
  chipSelected: { backgroundColor: '#000000', borderColor: '#000000' },
  textSelected: { color: '#ffffff' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: { width: '30%', borderWidth: 1, borderColor: '#cccccc', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  slotText: { fontSize: 16, color: '#000000' },
  message: { fontSize: 15, color: '#666666' },
  confirmBox: { borderTopWidth: 1, borderTopColor: '#eeeeee', marginTop: 28, paddingTop: 20 },
  summary: { fontSize: 16, fontWeight: '600', color: '#000000' },
  help: { fontSize: 14, color: '#666666', marginTop: 6 },
  button: { backgroundColor: '#000000', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  error: { color: '#c62828', marginTop: 16 },
});