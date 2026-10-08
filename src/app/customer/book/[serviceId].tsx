import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { AddressInput } from '../../../components/address-input';
import { MonthCalendar } from '../../../components/month-calendar';
import { formatDuration, formatPrice, OfferedAt } from '../../../lib/format';
import { Place } from '../../../lib/maps';
import { BusyTime, getOpenSlots } from '../../../lib/slots';
import { supabase } from '../../../lib/supabase';
import { colors, fonts, radius, spacing } from '../../../lib/theme';
import { ui } from '../../../lib/ui';

type Service = {
  id: number;
  name: string;
  price: number;
  duration_minutes: number;
  professional_id: string;
  offered_at: OfferedAt;
};

type Hours = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type Quote = {
  fee: number;
  km: number;
  in_range: boolean;
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
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
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
        .select('id, name, price, duration_minutes, professional_id, offered_at')
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
    if (!service || locationType !== 'at_customer' || !address) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    let cancelled = false;

    setQuoting(true);
    setQuoteError(null);

    supabase
      .rpc('quote_call_out_fee', {
        p_professional_id: service.professional_id,
        p_lat: address.lat,
        p_lng: address.lng,
      })
      .then(({ data, error: quoteErr }) => {
        if (cancelled) return;
        setQuoting(false);

        if (quoteErr) {
          setQuote(null);
          setQuoteError(quoteErr.message);
          return;
        }

        const row = Array.isArray(data) ? data[0] : data;
        setQuote(row ? { fee: Number(row.fee), km: row.km, in_range: row.in_range } : null);
      });

    return () => {
      cancelled = true;
    };
  }, [service, locationType, address?.lat, address?.lng]);

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
  const callOutFee = isHome ? Number(quote?.fee ?? 0) : 0;
  const total = Number(service?.price ?? 0) + callOutFee;
  const addressIsNew = !!address && address.address !== savedAddress?.address;
  const canConfirm = !isHome || (!!address && !!quote && quote.in_range && !quoting);

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
      <View style={ui.centered}>
        <ActivityIndicator size="large" color={colors.accentDark} />
      </View>
    );
  }

  if (!service) {
    return (
      <View style={[ui.screen, ui.content]}>
        <Text style={ui.error}>{error}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={ui.screen}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <View style={styles.serviceCard}>
          <Text style={styles.serviceName}>{service.name}</Text>
          <View style={styles.serviceMeta}>
            <Ionicons name="time-outline" size={15} color={colors.textMuted} />
            <Text style={styles.serviceMetaText}>{formatDuration(service.duration_minutes)}</Text>
            <Text style={styles.servicePrice}>{formatPrice(service.price)}</Text>
          </View>
        </View>

        {service.offered_at === 'both' && (
          <>
            <Text style={ui.sectionTitle}>Where?</Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.placeCard, !isHome && styles.placeCardSelected]}
                onPress={() => setLocationType('at_professional')}
              >
                <Ionicons name="storefront-outline" size={22} color={!isHome ? colors.accentDark : colors.textMuted} />
                <Text style={[styles.placeText, !isHome && styles.placeTextSelected]}>At their place</Text>
              </Pressable>
              <Pressable
                style={[styles.placeCard, isHome && styles.placeCardSelected]}
                onPress={() => setLocationType('at_customer')}
              >
                <Ionicons name="home-outline" size={22} color={isHome ? colors.accentDark : colors.textMuted} />
                <Text style={[styles.placeText, isHome && styles.placeTextSelected]}>At my home</Text>
              </Pressable>
            </View>
          </>
        )}

        {isHome && (
          <>
            <Text style={ui.sectionTitle}>Your address</Text>
            <AddressInput value={address} onChange={setAddress} />
            {addressIsNew && (
              <View style={styles.saveRow}>
                <Text style={styles.saveText}>Save as my home address</Text>
                <Switch
                  value={saveAddress}
                  onValueChange={setSaveAddress}
                  trackColor={{ true: colors.accentDark, false: colors.border }}
                />
              </View>
            )}

            {quoting && <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.accentDark} />}
            {!quoting && quote && quote.in_range && (
              <View style={styles.quoteBox}>
                <Ionicons name="car-outline" size={18} color={colors.accentDark} />
                <Text style={styles.quoteText}>
                  Call-out fee: {formatPrice(quote.fee)} · about {quote.km} km
                </Text>
              </View>
            )}
            {!quoting && quote && !quote.in_range && (
              <Text style={ui.error}>
                Your address is about {quote.km} km away, outside the area this professional travels to.
              </Text>
            )}
            {!quoting && quoteError && <Text style={ui.error}>{quoteError}</Text>}
          </>
        )}

        <Text style={ui.sectionTitle}>Choose a date</Text>

        {hours.length === 0 ? (
          <Text style={ui.muted}>This professional hasn't set their working hours yet.</Text>
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
            {loadingMonth && <ActivityIndicator style={{ marginTop: spacing.sm }} color={colors.accentDark} />}
          </>
        )}

        {selectedDate && (
          <>
            <Text style={ui.sectionTitle}>
              Times on {dayNames[selectedDate.getDay()]} {selectedDate.getDate()} {monthNames[selectedDate.getMonth()]}
            </Text>
            {slots.length === 0 ? (
              <Text style={ui.muted}>No open times on this day. Try another date.</Text>
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

        {error && <Text style={ui.error}>{error}</Text>}

        {selectedSlot && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{service.name}</Text>
            <View style={styles.summaryLine}>
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
              <Text style={styles.summaryText}>
                {dayNames[selectedSlot.getDay()]} {selectedSlot.getDate()} {monthNames[selectedSlot.getMonth()]} at {formatTime(selectedSlot)}
              </Text>
            </View>
            <View style={styles.summaryLine}>
              <Ionicons name={isHome ? 'home-outline' : 'storefront-outline'} size={16} color={colors.textMuted} />
              <Text style={styles.summaryText}>{isHome ? 'At your home' : 'At their place'}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Service</Text>
              <Text style={styles.priceValue}>{formatPrice(service.price)}</Text>
            </View>
            {isHome && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Call-out fee</Text>
                <Text style={styles.priceValue}>{quote ? formatPrice(callOutFee) : '–'}</Text>
              </View>
            )}
            <View style={[styles.priceRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{!isHome || quote ? formatPrice(total) : '–'}</Text>
            </View>

            <Pressable
              style={[ui.button, (confirming || !canConfirm) && ui.buttonDisabled]}
              onPress={handleConfirm}
              disabled={confirming || !canConfirm}
            >
              {confirming ? <ActivityIndicator color={colors.onAccent} /> : <Text style={ui.buttonText}>Confirm booking</Text>}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  serviceCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  serviceName: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  serviceMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  serviceMetaText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, flex: 1 },
  servicePrice: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  row: { flexDirection: 'row', gap: spacing.md },
  placeCard: { flex: 1, alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.lg },
  placeCardSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accentDark },
  placeText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted },
  placeTextSelected: { color: colors.accentDark },
  saveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  saveText: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  quoteBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.accentSoft, borderRadius: radius.sm, padding: spacing.md, marginTop: spacing.md },
  quoteText: { fontFamily: fonts.medium, fontSize: 15, color: colors.accentDark },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slotChip: { width: '31%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center' },
  slotChipSelected: { backgroundColor: colors.accentDark, borderColor: colors.accentDark },
  slotText: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  slotTextSelected: { color: colors.onAccent },
  summaryCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginTop: 28 },
  summaryTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, marginBottom: spacing.sm },
  summaryLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  summaryText: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  priceLabel: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted },
  priceValue: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm },
  totalLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  totalValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
});