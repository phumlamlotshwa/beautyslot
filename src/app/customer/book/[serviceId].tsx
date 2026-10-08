import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MonthCalendar } from '../../../components/month-calendar';
import { formatDuration, formatPrice } from '../../../lib/format';
import { BusyTime, getOpenSlots } from '../../../lib/slots';
import { supabase } from '../../../lib/supabase';

type Service = {
  id: number;
  name: string;
  price: number;
  duration_minutes: number;
  professional_id: string;
};

type Hours = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};


const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function BookService() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();

     const today = new Date();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [service, setService] = useState<Service | null>(null);
  const [hours, setHours] = useState<Hours[]>([]);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [monthBusy, setMonthBusy] = useState<BusyTime[]>([]);
  const [availableDays, setAvailableDays] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Date[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadService() {
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select('id, name, price, duration_minutes, professional_id')
        .eq('id', serviceId)
        .single();

      if (serviceError || !serviceData) {
        setError(serviceError?.message ?? 'Service not found.');
        setLoading(false);
        return;
      }

      const { data: hoursData, error: hoursError } = await supabase
        .from('working_hours')
        .select('day_of_week, start_time, end_time')
        .eq('professional_id', serviceData.professional_id);

      if (hoursError) {
        setError(hoursError.message);
      }

      setService(serviceData);
      setHours(hoursData ?? []);
      setLoading(false);
    }

    loadService();
  }, [serviceId]);

  useEffect(() => {
    if (!service) return;

    let cancelled = false;

    async function loadMonth() {
      if (!service) return;

      setLoadingMonth(true);
      setError(null);

      const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
      const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);

      const { data, error: busyError } = await supabase.rpc('get_busy_times', {
        p_professional_id: service.professional_id,
        p_from: monthStart.toISOString(),
        p_to: monthEnd.toISOString(),
      });

      if (cancelled) return;

      if (busyError) {
        setError(busyError.message);
        setLoadingMonth(false);
        return;
      }

      const busy = (data ?? []) as BusyTime[];
      const available = new Set<string>();

      for (let d = new Date(monthStart); d < monthEnd; d.setDate(d.getDate() + 1)) {
        const dayHours = hours.find((h) => h.day_of_week === d.getDay());
        if (!dayHours) continue;

        const openSlots = getOpenSlots(
          d,
          dayHours.start_time.slice(0, 5),
          dayHours.end_time.slice(0, 5),
          service.duration_minutes,
          busy
        );

        if (openSlots.length > 0) {
          available.add(d.toDateString());
        }
      }

      setMonthBusy(busy);
      setAvailableDays(available);
      setLoadingMonth(false);
    }

    loadMonth();

    return () => {
      cancelled = true;
    };
  }, [service, hours, visibleMonth]);

  function changeMonth(month: Date) {
    setVisibleMonth(month);
    setSelectedDate(null);
    setSelectedSlot(null);
    setSlots([]);
  }

  function selectDate(date: Date) {
    setSelectedDate(date);
    setSelectedSlot(null);

    const dayHours = hours.find((h) => h.day_of_week === date.getDay());

    if (!service || !dayHours) {
      setSlots([]);
      return;
    }

    setSlots(
      getOpenSlots(
        date,
        dayHours.start_time.slice(0, 5),
        dayHours.end_time.slice(0, 5),
        service.duration_minutes,
        monthBusy
      )
    );
  }

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  if (!service) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.serviceCard}>
        <Text style={styles.serviceName}>{service.name}</Text>
        <Text style={styles.serviceDetails}>
          {formatDuration(service.duration_minutes)} · {formatPrice(service.price)}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Choose a date</Text>

      {hours.length === 0 ? (
        <Text style={styles.message}>This professional hasn't set their working hours yet.</Text>
      ) : (
        <>
          <MonthCalendar
            month={visibleMonth}
            minMonth={thisMonth}
            selectedDate={selectedDate}
            isAvailable={(date) => !loadingMonth && availableDays.has(date.toDateString())}
            onSelectDate={selectDate}
            onChangeMonth={changeMonth}
          />
          {loadingMonth ? (
            <ActivityIndicator style={{ marginTop: 8 }} color="#000000" />
          ) : (
            <Text style={styles.hint}>Grey dates are unavailable or fully booked.</Text>
          )}
        </>
      )}

      {selectedDate && (
        <>
          <Text style={styles.sectionTitle}>
            Times on {dayNames[selectedDate.getDay()]} {selectedDate.getDate()} {monthNames[selectedDate.getMonth()]}
          </Text>
          {slots.length === 0 ? (
            <Text style={styles.message}>No open times on this day. Try another date.</Text>
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

      {selectedSlot && (
        <Text style={styles.summary}>
          You picked {dayNames[selectedSlot.getDay()]} {selectedSlot.getDate()} {monthNames[selectedSlot.getMonth()]} at {formatTime(selectedSlot)}
        </Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 24, paddingBottom: 48 },
  serviceCard: { borderWidth: 1, borderColor: '#eeeeee', borderRadius: 12, padding: 16 },
  serviceName: { fontSize: 18, fontWeight: '700', color: '#000000' },
  serviceDetails: { fontSize: 14, color: '#666666', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000000', marginTop: 28, marginBottom: 12 },
  hint: { fontSize: 13, color: '#999999', textAlign: 'center', marginTop: 8 },
  chipSelected: { backgroundColor: '#000000', borderColor: '#000000' },
  textSelected: { color: '#ffffff' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: { width: '30%', borderWidth: 1, borderColor: '#cccccc', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  slotText: { fontSize: 16, color: '#000000' },
  message: { fontSize: 15, color: '#666666', marginTop: 8 },
  summary: { fontSize: 16, fontWeight: '600', color: '#000000', marginTop: 24 },
  error: { color: '#c62828', marginTop: 16 },
});