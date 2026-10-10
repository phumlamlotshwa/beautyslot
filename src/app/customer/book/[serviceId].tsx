import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { AddressInput } from '../../../components/address-input';
import { Avatar } from '../../../components/avatar';
import { MonthCalendar } from '../../../components/month-calendar';
import { formatDuration, formatPrice, OfferedAt } from '../../../lib/format';
import { getSavedAddresses, markAddressUsed, SavedAddress, saveAddress, shortAddress } from '../../../lib/location';
import { Place } from '../../../lib/maps';
import { deletePhoto, PhotoSource, pickPhoto, professionalPhotoUrl, uploadPhoto } from '../../../lib/photos';
import { getOpenSlots } from '../../../lib/slots';
import { supabase } from '../../../lib/supabase';
import { fonts, radius, spacing } from '../../../lib/theme';
import { makeStyles, useTheme } from '../../../lib/theme-context';
import { useUi } from '../../../lib/ui';

type Service = {
  id: number;
  name: string;
  price: number;
  duration_minutes: number;
  professional_id: string;
  offered_at: OfferedAt;
};

type WorkPhoto = { id: number; path: string };
type Hours = { day_of_week: number; start_time: string; end_time: string };
type Member = { id: number; name: string; avatar_path: string | null; hours: Hours[] };
type TeamBusy = { staff_id: number; starts_at: string; ends_at: string };
type Quote = { fee: number; km: number; in_range: boolean };
type LocationType = 'at_professional' | 'at_customer';
type Choice = number | 'any';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function BookService() {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const waitingForAccount = useRef(false);

  const today = new Date();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [service, setService] = useState<Service | null>(null);
  const [workPhotos, setWorkPhotos] = useState<WorkPhoto[]>([]);
  const [refPhotoId, setRefPhotoId] = useState<number | null>(null);
  const [ownPhotoUri, setOwnPhotoUri] = useState<string | null>(null);
  const [team, setTeam] = useState<Member[]>([]);
  const [choice, setChoice] = useState<Choice>('any');
  const [locationType, setLocationType] = useState<LocationType>('at_professional');
  const [address, setAddress] = useState<Place | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [addressLabel, setAddressLabel] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressMessage, setAddressMessage] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [monthBusy, setMonthBusy] = useState<TeamBusy[]>([]);
  const [availableDays, setAvailableDays] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Date[]>([]);
  const [slotStaff, setSlotStaff] = useState<Map<number, number[]>>(new Map());
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = choice === 'any' ? team : team.filter((m) => m.id === choice);

  function slotsFor(member: Member, date: Date, busy: TeamBusy[]) {
    const dayHours = member.hours.find((h) => h.day_of_week === date.getDay());
    if (!service || !dayHours) return [];
    return getOpenSlots(
      date,
      dayHours.start_time.slice(0, 5),
      dayHours.end_time.slice(0, 5),
      service.duration_minutes,
      busy.filter((b) => b.staff_id === member.id)
    );
  }

  useEffect(() => {
    async function loadService() {
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select('id, name, price, duration_minutes, professional_id, offered_at')
        .eq('id', serviceId)
        .single();

      if (serviceError || !serviceData) {
        setError(serviceError?.message ?? "This service isn't available any more.");
        setLoading(false);
        return;
      }

      const typedService = serviceData as unknown as Service;

      const { data: staffData, error: staffError } = await supabase
        .from('staff_services')
        .select('staff(id, name, avatar_path, is_active, created_at, working_hours(day_of_week, start_time, end_time))')
        .eq('service_id', typedService.id);

      if (staffError) setError(staffError.message);

      const members: Member[] = ((staffData ?? []) as any[])
        .map((row) => row.staff)
        .filter((s) => s && s.is_active)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((s) => ({ id: s.id, name: s.name, avatar_path: s.avatar_path, hours: s.working_hours ?? [] }));

      const { data: photoData } = await supabase
        .from('portfolio_photos')
        .select('id, path')
        .eq('professional_id', typedService.professional_id)
        .order('created_at', { ascending: false })
        .limit(30);

      setWorkPhotos((photoData ?? []) as WorkPhoto[]);

      if (typedService.offered_at !== 'at_professional') {
        const saved = await getSavedAddresses();
        setSavedAddresses(saved);
        if (saved[0]) {
          setAddress({ address: saved[0].address, lat: saved[0].lat, lng: saved[0].lng });
        }
      }

      setLocationType(typedService.offered_at === 'at_customer' ? 'at_customer' : 'at_professional');
      setTeam(members);
      setChoice(members.length === 1 ? members[0].id : 'any');
      setService(typedService);
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
    if (!service || team.length === 0) return;

    let cancelled = false;

    async function loadMonth() {
      if (!service) return;

      setLoadingMonth(true);

      const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
      const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);

      const { data, error: busyError } = await supabase.rpc('get_team_busy_times', {
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

      const busy = (data ?? []) as TeamBusy[];
      const available = new Set<string>();

      for (let d = new Date(monthStart); d < monthEnd; d.setDate(d.getDate() + 1)) {
        if (candidates.some((m) => slotsFor(m, d, busy).length > 0)) {
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
  }, [service, team, choice, visibleMonth, refreshKey]);

  function resetTimes() {
    setSelectedDate(null);
    setSelectedSlot(null);
    setSlots([]);
    setSlotStaff(new Map());
    setError(null);
  }

  function changeMonth(month: Date) {
    setVisibleMonth(month);
    resetTimes();
  }

  function changeChoice(next: Choice) {
    setChoice(next);
    resetTimes();
  }

  function selectDate(date: Date) {
    setSelectedDate(date);
    setSelectedSlot(null);
    setError(null);

    const map = new Map<number, number[]>();
    for (const member of candidates) {
      for (const slot of slotsFor(member, date, monthBusy)) {
        const time = slot.getTime();
        map.set(time, [...(map.get(time) ?? []), member.id]);
      }
    }

    setSlotStaff(map);
    setSlots([...map.keys()].sort((a, b) => a - b).map((t) => new Date(t)));
  }

  const isHome = locationType === 'at_customer';
  const callOutFee = isHome ? Number(quote?.fee ?? 0) : 0;
  const total = Number(service?.price ?? 0) + callOutFee;
  const matchingSaved = savedAddresses.find((a) => a.address === address?.address) ?? null;
  const addressIsNew = !!address && !matchingSaved;
  const canConfirm = !isHome || (!!address && !!quote && quote.in_range && !quoting);
  const chosenMember = choice === 'any' ? null : team.find((m) => m.id === choice) ?? null;

  function pickSaved(saved: SavedAddress) {
    setAddressMessage(null);
    setAddress({ address: saved.address, lat: saved.lat, lng: saved.lng });
  }

  async function handleSaveAddress() {
    if (!address) return;

    setAddressMessage(null);
    setSavingAddress(true);
    const problem = await saveAddress(address, addressLabel.trim() || undefined);
    setSavingAddress(false);

    if (problem) {
      setAddressMessage(`The address wasn't saved: ${problem}`);
      return;
    }

    setSavedAddresses(await getSavedAddresses());
    setAddressLabel('');
    setAddressMessage('Saved. It will be ready next time you book.');
  }

  async function addOwnPhoto(source: PhotoSource) {
    setError(null);
    try {
      const uri = await pickPhoto(source, false);
      if (uri) {
        setOwnPhotoUri(uri);
        setRefPhotoId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open your photos.");
    }
  }

  function handleAddOwnPhoto() {
    Alert.alert('Add a photo', undefined, [
      { text: 'Take a photo', onPress: () => addOwnPhoto('camera') },
      { text: 'Choose from library', onPress: () => addOwnPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  useFocusEffect(
    useCallback(() => {
      if (!waitingForAccount.current) return;
      waitingForAccount.current = false;

      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) handleConfirm();
      });
    }, [handleConfirm])
  );

  function pickWorkPhoto(id: number) {
    setOwnPhotoUri(null);
    setRefPhotoId(refPhotoId === id ? null : id);
  }

  async function handleConfirm() {
    if (!service || !selectedSlot) return;

    setError(null);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      waitingForAccount.current = true;
      router.push({ pathname: '/sign-up', params: { returnTo: `/customer/book/${serviceId}` } });
      return;
    }

    if (isHome && !address) {
      setError('Search for your address and pick it from the list.');
      return;
    }

    setConfirming(true);

    let referencePath: string | null = null;
    if (ownPhotoUri) {
      try {
        referencePath = await uploadPhoto('booking-photos', user.id, ownPhotoUri, 1200);
      } catch {
        setError("Your photo didn't upload. Try again, or book without it.");
        setConfirming(false);
        return;
      }
    }

    const startsAt = selectedSlot;
    const endsAt = new Date(selectedSlot.getTime() + service.duration_minutes * 60 * 1000);
    const freeStaff = slotStaff.get(selectedSlot.getTime()) ?? [];

    let bookedWith: Member | undefined;
    let lastError: { code?: string; message: string } | null = null;

    for (const staffId of freeStaff) {
      const { error: bookingError } = await supabase.from('bookings').insert({
        customer_id: user.id,
        professional_id: service.professional_id,
        staff_id: staffId,
        service_id: service.id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        location_type: locationType,
        address: isHome ? address!.address : null,
        address_lat: isHome ? address!.lat : null,
        address_lng: isHome ? address!.lng : null,
        reference_photo_id: referencePath ? null : refPhotoId,
        reference_path: referencePath,
      });

      if (!bookingError) {
        bookedWith = team.find((m) => m.id === staffId);
        lastError = null;
        break;
      }

      lastError = bookingError;
      if (bookingError.code !== '23P01') break;
    }

    if (!bookedWith) {
      if (referencePath) await deletePhoto('booking-photos', referencePath);
      setConfirming(false);
      if (!lastError || lastError.code === '23P01') {
        setError('Someone just booked that time. Pick another one.');
        resetTimes();
        setRefreshKey((k) => k + 1);
      } else {
        setError(lastError.message);
      }
      return;
    }

    if (isHome && matchingSaved) {
      markAddressUsed(matchingSaved.id);
    }

    setConfirming(false);

    const withWho = team.length > 1 ? ` with ${bookedWith.name}` : '';

    Alert.alert(
      'Request sent',
      `${service.name}${withWho} on ${dayNames[startsAt.getDay()]} ${startsAt.getDate()} ${monthNames[startsAt.getMonth()]} at ${formatTime(startsAt)}${isHome ? ' as a house call' : ''}. You'll see it under My bookings, and it moves to Confirmed once they accept.`,
      [{ text: 'Done', onPress: () => router.dismissTo('/customer') }]
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

  const nobodyHasHours = candidates.every((m) => m.hours.length === 0);

  return (
    <KeyboardAvoidingView style={ui.screen} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <View style={styles.serviceCard}>
          <Text style={styles.serviceName}>{service.name}</Text>
          <View style={styles.serviceMeta}>
            <Text style={styles.serviceMetaText}>{formatDuration(service.duration_minutes)}</Text>
            <Text style={styles.servicePrice}>{formatPrice(service.price)}</Text>
          </View>
        </View>

        {team.length > 0 && (
          <>
            <Text style={ui.sectionTitle}>Show them what you want</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {ownPhotoUri ? (
                <View style={[styles.photoTile, styles.photoTileSelected]}>
                  <Image source={{ uri: ownPhotoUri }} style={styles.photoImage} contentFit="cover" />
                  <Pressable style={styles.removePhoto} onPress={() => setOwnPhotoUri(null)} hitSlop={8}>
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : (
                <Pressable style={[styles.photoTile, styles.addPhotoTile]} onPress={handleAddOwnPhoto}>
                  <Ionicons name="camera-outline" size={22} color={colors.text} />
                  <Text style={styles.addPhotoText}>Your photo</Text>
                </Pressable>
              )}
              {workPhotos.map((p) => {
                const isSelected = refPhotoId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    style={[styles.photoTile, isSelected && styles.photoTileSelected]}
                    onPress={() => pickWorkPhoto(p.id)}
                  >
                    <Image
                      source={{ uri: professionalPhotoUrl(p.path) ?? undefined }}
                      style={styles.photoImage}
                      contentFit="cover"
                    />
                    {isSelected && (
                      <View style={styles.photoTick}>
                        <Ionicons name="checkmark" size={14} color={colors.onAccent} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={ui.help}>
              {workPhotos.length > 0
                ? 'Tap one of their photos, or add your own.'
                : 'Add a photo of the look you want.'}
            </Text>
          </>
        )}

        {team.length === 0 ? (
          <Text style={[ui.muted, { marginTop: spacing.xl }]}>Nobody is taking bookings for this service right now.</Text>
        ) : (
          <>
            {team.length > 1 && (
              <>
                <Text style={ui.sectionTitle}>Who would you like?</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.staffRow}>
                  <Pressable
                    style={[styles.staffChip, choice === 'any' && styles.staffChipSelected]}
                    onPress={() => changeChoice('any')}
                  >
                    <View style={styles.anyIcon}>
                      <Ionicons name="people-outline" size={18} color={colors.text} />
                    </View>
                    <Text style={[styles.staffName, choice === 'any' && styles.staffNameSelected]}>Anyone available</Text>
                  </Pressable>
                  {team.map((m) => (
                    <Pressable
                      key={m.id}
                      style={[styles.staffChip, choice === m.id && styles.staffChipSelected]}
                      onPress={() => changeChoice(m.id)}
                    >
                      <Avatar name={m.name} url={professionalPhotoUrl(m.avatar_path)} size={32} />
                      <Text style={[styles.staffName, choice === m.id && styles.staffNameSelected]}>{m.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            {service.offered_at === 'both' && (
              <>
                <Text style={ui.sectionTitle}>Where should it happen?</Text>
                <View style={styles.row}>
                  <Pressable
                    style={[styles.placeCard, !isHome && styles.placeCardSelected]}
                    onPress={() => setLocationType('at_professional')}
                  >
                    <Ionicons name="storefront-outline" size={22} color={!isHome ? colors.onAccent : colors.text} />
                    <Text style={[styles.placeText, !isHome && styles.placeTextSelected]}>At their place</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.placeCard, isHome && styles.placeCardSelected]}
                    onPress={() => setLocationType('at_customer')}
                  >
                    <Ionicons name="home-outline" size={22} color={isHome ? colors.onAccent : colors.text} />
                    <Text style={[styles.placeText, isHome && styles.placeTextSelected]}>House call</Text>
                  </Pressable>
                </View>
              </>
            )}

            {isHome && (
              <>
                <Text style={ui.sectionTitle}>Your address</Text>

                {savedAddresses.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedChips}>
                    {savedAddresses.map((a) => {
                      const selected = matchingSaved?.id === a.id;
                      return (
                        <Pressable
                          key={a.id}
                          style={[ui.chip, styles.savedChip, selected && ui.chipSelected]}
                          onPress={() => pickSaved(a)}
                        >
                          <Text style={[ui.chipText, selected && ui.chipTextSelected]} numberOfLines={1}>
                            {a.label || shortAddress(a.address)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}

                <AddressInput
                  value={address}
                  onChange={(place) => {
                    setAddressMessage(null);
                    setAddress(place);
                  }}
                />

                {addressIsNew && (
                  <View style={styles.saveCard}>
                    <Text style={styles.saveTitle}>Save this address for next time?</Text>
                    <View style={styles.nameChips}>
                      {['Home', 'Work'].map((name) => (
                        <Pressable
                          key={name}
                          style={[ui.chip, addressLabel === name && ui.chipSelected]}
                          onPress={() => setAddressLabel(addressLabel === name ? '' : name)}
                        >
                          <Text style={[ui.chipText, addressLabel === name && ui.chipTextSelected]}>{name}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      style={[ui.input, styles.nameInput]}
                      value={addressLabel}
                      onChangeText={setAddressLabel}
                      placeholder="Or type your own name for it (optional)"
                      placeholderTextColor={colors.textFaint}
                      maxLength={30}
                    />
                    <Pressable
                      style={[styles.saveButton, savingAddress && ui.buttonDisabled]}
                      onPress={handleSaveAddress}
                      disabled={savingAddress}
                    >
                      {savingAddress ? (
                        <ActivityIndicator color={colors.text} />
                      ) : (
                        <Text style={styles.saveButtonText}>Save address</Text>
                      )}
                    </Pressable>
                  </View>
                )}
                {addressMessage && (
                  <Text style={addressMessage.startsWith('Saved') ? styles.addressMessage : ui.error}>{addressMessage}</Text>
                )}

                {quoting && <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.accentDark} />}
                {!quoting && quote && quote.in_range && (
                  <View style={styles.quoteBox}>
                    <Ionicons name="car-outline" size={18} color={colors.text} />
                    <Text style={styles.quoteText}>
                      {Number(quote.fee) > 0
                        ? `${formatPrice(quote.fee)} call-out fee for about ${quote.km} km`
                        : `No call-out fee for about ${quote.km} km`}
                    </Text>
                  </View>
                )}
                {!quoting && quote && !quote.in_range && (
                  <Text style={ui.error}>
                    Your address is about {quote.km} km away, which is further than they travel. Try booking at their place instead.
                  </Text>
                )}
                {!quoting && quoteError && <Text style={ui.error}>{quoteError}</Text>}
              </>
            )}

            <Text style={ui.sectionTitle}>Pick a day</Text>

            {nobodyHasHours ? (
              <Text style={ui.muted}>
                {chosenMember ? `${chosenMember.name} hasn't` : "They haven't"} set working hours yet.
              </Text>
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
          </>
        )}

        {error && <Text style={ui.error}>{error}</Text>}

        {selectedSlot && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{service.name}</Text>
            {team.length > 1 && (
              <View style={styles.summaryLine}>
                <Ionicons name="person-outline" size={16} color={colors.textMuted} />
                <Text style={styles.summaryText}>
                  {chosenMember ? `With ${chosenMember.name}` : 'With whoever is free at that time'}
                </Text>
              </View>
            )}
            <View style={styles.summaryLine}>
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
              <Text style={styles.summaryText}>
                {dayNames[selectedSlot.getDay()]} {selectedSlot.getDate()} {monthNames[selectedSlot.getMonth()]} at {formatTime(selectedSlot)}
              </Text>
            </View>
            <View style={styles.summaryLine}>
              <Ionicons name={isHome ? 'home-outline' : 'storefront-outline'} size={16} color={colors.textMuted} />
              <Text style={styles.summaryText}>{isHome ? 'House call' : 'At their place'}</Text>
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

            <Text style={styles.requestNote}>
              {ownPhotoUri || refPhotoId
                ? "They'll look at your photo first. If it costs more, you'll be asked before it's confirmed."
                : 'Your booking is confirmed once they accept it.'}
            </Text>

            <Pressable
              style={[ui.button, (confirming || !canConfirm) && ui.buttonDisabled]}
              onPress={handleConfirm}
              disabled={confirming || !canConfirm}
            >
              {confirming ? <ActivityIndicator color={colors.onAccent} /> : <Text style={ui.buttonText}>Send booking request</Text>}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  serviceCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg },
  serviceName: { fontFamily: fonts.extraBold, fontSize: 20, lineHeight: 24, color: colors.text },
  serviceMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  serviceMetaText: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted, flex: 1 },
  servicePrice: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  staffRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  staffChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: spacing.lg,
  },
  staffChipSelected: { backgroundColor: colors.accentDark },
  anyIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  staffName: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  staffNameSelected: { color: colors.onAccent },
  row: { flexDirection: 'row', gap: spacing.md },
  placeCard: { flex: 1, alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.lg },
  placeCardSelected: { backgroundColor: colors.accentDark },
  placeText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  placeTextSelected: { color: colors.onAccent },
  savedChips: { gap: spacing.sm, paddingBottom: spacing.md },
  savedChip: { maxWidth: 220 },
  saveCard: { backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.md, marginTop: spacing.md },
  saveTitle: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text, marginBottom: spacing.sm },
  nameChips: { flexDirection: 'row', gap: spacing.sm },
  nameInput: { marginTop: spacing.sm },
  saveButton: {
    borderWidth: 1.5,
    borderColor: colors.accentDark,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveButtonText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  addressMessage: { fontFamily: fonts.medium, fontSize: 14, color: colors.text, marginTop: spacing.sm },
  quoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  quoteText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slotChip: { width: '31%', backgroundColor: colors.surface, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center' },
  slotChipSelected: { backgroundColor: colors.accentDark },
  slotText: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.text },
  slotTextSelected: { color: colors.onAccent },
  summaryCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginTop: 28 },
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
  photoRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  photoTile: {
    width: 84,
    height: 84,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.accentSoft,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  photoTileSelected: { borderColor: colors.accentDark },
  photoImage: { width: '100%', height: '100%' },
  addPhotoTile: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  addPhotoText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.text, marginTop: 4 },
  photoTick: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accentDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhoto: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestNote: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted, marginTop: spacing.lg },
}));