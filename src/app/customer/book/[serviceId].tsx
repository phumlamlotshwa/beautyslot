import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { AddressInput } from '../../../components/address-input';
import { MonthCalendar } from '../../../components/month-calendar';
import { formatDuration, formatPrice, OfferedAt } from '../../../lib/format';
import { Place } from '../../../lib/maps';
import { BusyTime, getOpenSlots } from '../../../lib/slots';
import { supabase } from '../../../lib/supabase';

type Service = {
  id: number;
  name: string;
  price: number;
  duration_minutes: number;
  professional_id: string;
  offered_at: OfferedAt;
  professionals: { call_out_fee: number } | null;
};

type Hours = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type LocationType = 'at_professional' | 'at_customer';

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
  const [locationType, setLocationType] = useState<LocationType>('at_professional');
  const [address, setAddress] = useState<Place | null>(null);
  const [savedAddress, setSavedAddress] = useState<Place | null>(null);
  const [saveAddress, setSaveAddress] = useState(true);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [monthBusy, setMonthBusy] = useState<BusyTime[]>([]);
  const [availableDays, setAvailableDays] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Date[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadService() {
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select('id, name, price, duration_minutes, professional_id, offered_at, professionals(call_out_fee)')
        .eq('id', serviceId)
        .single();

      if (serviceError || !serviceData) {
        setError(serviceError?.message ?? 'Service not found.');
        setLoading(false);
        return;
      }

      const typedService = serviceData as unknown as Service;

      const { data: hoursData, error: hoursError } = await supabase
        .from('working_hours')
        .select('day_of_week, start_time, end_time')
        .eq('professional_id', typedService.professional_id);

      if (hoursError) {
        setError(hoursError.message);
      }

      if (typedService.offered_at !== 'at_professional') {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data: saved } = await supabase
            .from('customer_private')
            .select('home_address, home_lat, home_lng')
            .eq('customer_id', user.id)
            .maybeSingle();

          if (saved) {
            const place = { address: saved.home_address, lat: saved.home_lat, lng: saved.home_lng };
            setSavedAddress(place);
            setAddress(place);
          }
        }
      }

      setLocationType(typedService.offered_at === 'at_customer' ? 'at_customer' : 'at_professional');
      setService(typedService);
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
  }, [service, hours, visibleMonth, refreshKey]);

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

  const isHome = locationType === 'at_customer';
  const callOutFee = isHome ? Number(service?.professionals?.call_out_fee ?? 0) : 0;
  const total = Number(service?.price ?? 0) + callOutFee;
  const addressIsNew = !!address && address.address !== savedAddress?.address;

  async function handleConfirm() {
    if (!service || !selectedSlot) return;

    setError(null);

    if (isHome && !address) {
      setError('Please search for your address and choose it from the list.');
      return;
    }

    setConfirming(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('You need to be logged in to book.');
      setConfirming(false);
      return;
    }

    const startsAt = selectedSlot;
    const endsAt = new Date(selectedSlot.getTime() + service.duration_minutes * 60 * 1000);

    const { error: bookingError } = await supabase.from('bookings').insert({
      customer_id: user.id,
      professional_id: service.professional_id,
      service_id: service.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      location_type: locationType,
      address: isHome ? address!.address : null,
      address_lat: isHome ? address!.lat : null,
      address_lng: isHome ? address!.lng : null,
      call_out_fee: callOutFee,
    });

    if (bookingError) {
      setConfirming(false);
      if (bookingError.code === '23P01') {
        setError('Sorry, someone just booked that time. Please choose another.');
        setSelectedDate(null);
        setSelectedSlot(null);
        setSlots([]);
        setRefreshKey((k) => k + 1);
      } else {
        setError(bookingError.message);
      }
      return;
    }

    if (isHome && address && addressIsNew && saveAddress) {
      await supabase.from('customer_private').upsert({
        customer_id: user.id,
        home_address: address.address,
        home_lat: address.lat,
        home_lng: address.lng,
        updated_at: new Date().toISOString(),
      });
    }

    setConfirming(false);

    Alert.alert(
      'Booking requested',
      `${service.name} on ${dayNames[startsAt.getDay()]} ${startsAt.getDate()} ${monthNames[startsAt.getMonth()]} at ${formatTime(startsAt)}${isHome ? ' at your home' : ''}. The professional will confirm it soon.`,
      [{ text: 'OK', onPress: () => router.dismissTo('/customer') }]
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
    <KeyboardAvoidingView
      style={styles.screen}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.serviceCard}>
          <Text style={styles.serviceName}>{service.name}</Text>
          <Text style={styles.serviceDetails}>
            {formatDuration(service.duration_minutes)} · {formatPrice(service.price)}
          </Text>
        </View>

        {service.offered_at === 'both' && (
          <>
            <Text style={styles.sectionTitle}>Where?</Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.choice, !isHome && styles.chipSelected]}
                onPress={() => setLocationType('at_professional')}
              >
                <Text style={[styles.choiceText, !isHome && styles.textSelected]}>At their place</Text>
              </Pressable>
              <Pressable
                style={[styles.choice, isHome && styles.chipSelected]}
                onPress={() => setLocationType('at_customer')}
              >
                <Text style={[styles.choiceText, isHome && styles.textSelected]}>At my home</Text>
              </Pressable>
            </View>
          </>
        )}

        {isHome && (
          <>
            <Text style={styles.sectionTitle}>Your address</Text>
            <AddressInput value={address} onChange={setAddress} />
            {addressIsNew && (
              <View style={styles.saveRow}>
                <Text style={styles.saveText}>Save as my home address</Text>
                <Switch
                  value={saveAddress}
                  onValueChange={setSaveAddress}
                  trackColor={{ true: '#000000', false: '#cccccc' }}
                />
              </View>
            )}
            {callOutFee > 0 && (
              <Text style={styles.help}>A call-out fee of {formatPrice(callOutFee)} applies to home visits.</Text>
            )}
          </>
        )}

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

        {error && <Text style={styles.error}>{error}</Text>}

        {selectedSlot && (
          <View style={styles.confirmBox}>
            <Text style={styles.summary}>
              {service.name} on {dayNames[selectedSlot.getDay()]} {selectedSlot.getDate()} {monthNames[selectedSlot.getMonth()]} at {formatTime(selectedSlot)}
            </Text>
            <Text style={styles.summaryDetail}>{isHome ? 'At your home' : 'At their place'}</Text>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Service</Text>
              <Text style={styles.priceValue}>{formatPrice(service.price)}</Text>
            </View>
            {isHome && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Call-out fee</Text>
                <Text style={styles.priceValue}>{formatPrice(callOutFee)}</Text>
              </View>
            )}
            <View style={[styles.priceRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(total)}</Text>
            </View>

            <Pressable
              style={[styles.button, confirming && styles.buttonDisabled]}
              onPress={handleConfirm}
              disabled={confirming}
            >
              {confirming ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Confirm booking</Text>}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 24, paddingBottom: 48 },
  serviceCard: { borderWidth: 1, borderColor: '#eeeeee', borderRadius: 12, padding: 16 },
  serviceName: { fontSize: 18, fontWeight: '700', color: '#000000' },
  serviceDetails: { fontSize: 14, color: '#666666', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000000', marginTop: 28, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
  choice: { borderWidth: 1, borderColor: '#cccccc', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16 },
  choiceText: { color: '#000000' },
  saveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  saveText: { fontSize: 15, color: '#000000' },
  help: { fontSize: 14, color: '#666666', marginTop: 8 },
  hint: { fontSize: 13, color: '#999999', textAlign: 'center', marginTop: 8 },
  chipSelected: { backgroundColor: '#000000', borderColor: '#000000' },
  textSelected: { color: '#ffffff' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: { width: '30%', borderWidth: 1, borderColor: '#cccccc', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  slotText: { fontSize: 16, color: '#000000' },
  message: { fontSize: 15, color: '#666666', marginTop: 8 },
  confirmBox: { borderTopWidth: 1, borderTopColor: '#eeeeee', marginTop: 28, paddingTop: 20 },
  summary: { fontSize: 16, fontWeight: '600', color: '#000000' },
  summaryDetail: { fontSize: 14, color: '#666666', marginTop: 4, marginBottom: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  priceLabel: { fontSize: 15, color: '#666666' },
  priceValue: { fontSize: 15, color: '#000000' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#eeeeee', marginTop: 4, paddingTop: 8 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#000000' },
  totalValue: { fontSize: 16, fontWeight: '700', color: '#000000' },
  button: { backgroundColor: '#000000', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  error: { color: '#c62828', marginTop: 16 },
});