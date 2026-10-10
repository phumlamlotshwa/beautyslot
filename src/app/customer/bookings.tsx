import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, SectionList, Text, View } from 'react-native';
import { formatPrice } from '../../lib/format';
import { BookingStatus, statusStyle } from '../../lib/status';
import { supabase } from '../../lib/supabase';
import { fonts, radius, spacing } from '../../lib/theme';
import { makeStyles, useTheme } from '../../lib/theme-context';
import { useUi } from '../../lib/ui';
import { Avatar } from '../../components/avatar';
import { CountBadge } from '../../components/count-badge';
import { PhotoViewer } from '../../components/photo-viewer';
import { professionalPhotoUrl } from '../../lib/photos';
import { shortAddress } from '../../lib/location';

type Booking = {
  id: number;
  professional_id: string;
  starts_at: string;
  previous_starts_at: string | null;
  requested_starts_at: string | null;
  declined_starts_at: string | null;
  change_reason: string | null;
  reference_photo_id: number | null;
  reference_path: string | null;
  agreed_price: number | null;
  proposed_price: number | null;
  price_reason: string | null;
  status: BookingStatus;
  location_type: 'at_professional' | 'at_customer';
  address: string | null;
  call_out_fee: number;
  services: { name: string; price: number } | null;
  professionals: { first_name: string; last_name: string; avatar_path: string | null } | null;
  staff: { name: string } | null;
};

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatBookingTime(iso: string) {
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()} at ${time}`;
}

function stylistName(booking: Booking) {
  const staffName = booking.staff?.name?.trim();
  if (!staffName) return null;

  const first = booking.professionals?.first_name?.trim() ?? '';
  const full = `${first} ${booking.professionals?.last_name?.trim() ?? ''}`.trim();
  const same = [first, full].some((n) => n.toLowerCase() === staffName.toLowerCase());

  return same ? null : staffName;
}

function openDirections(address: string) {
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
}

export default function MyBookings() {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [proAddresses, setProAddresses] = useState<Record<number, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [answeringId, setAnsweringId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [referenceUrls, setReferenceUrls] = useState<Record<number, string>>({});
  const [viewing, setViewing] = useState<string | null>(null);

  function toggleSection(title: string) {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }

  async function loadReferenceUrls(list: Booking[]) {
    const urls: Record<number, string> = {};

    const photoIds = list.filter((b) => b.reference_photo_id).map((b) => b.reference_photo_id!);
    if (photoIds.length > 0) {
      const { data } = await supabase.from('portfolio_photos').select('id, path').in('id', photoIds);
      const paths = new Map<number, string>((data ?? []).map((p: { id: number; path: string }) => [p.id, p.path]));
      for (const b of list) {
        const path = b.reference_photo_id ? paths.get(b.reference_photo_id) : null;
        const url = path ? professionalPhotoUrl(path) : null;
        if (url) urls[b.id] = url;
      }
    }

    const withOwn = list.filter((b) => b.reference_path);
    if (withOwn.length > 0) {
      const { data } = await supabase.storage.from('booking-photos').createSignedUrls(
        withOwn.map((b) => b.reference_path!),
        60 * 60,
      );
      withOwn.forEach((b, i) => {
        const url = data?.[i]?.signedUrl;
        if (url) urls[b.id] = url;
      });
    }

    return urls;
  }

  const loadBookings = useCallback(async () => {
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error: loadError } = await supabase
      .from('bookings')
      .select(
        'id, professional_id, starts_at, previous_starts_at, requested_starts_at, declined_starts_at, change_reason, reference_photo_id, reference_path, agreed_price, proposed_price, price_reason, status, location_type, address, call_out_fee, services(name, price), professionals(first_name, last_name, avatar_path), staff(name)',
      )
      .eq('customer_id', user.id)
      .order('starts_at', { ascending: true });

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    const loaded = (data ?? []) as unknown as Booking[];
    setBookings(loaded);
    setReferenceUrls(await loadReferenceUrls(loaded));

    const now = Date.now();
    const needsAddress = loaded.filter(
      (b) =>
        b.status === 'confirmed' && b.location_type === 'at_professional' && new Date(b.starts_at).getTime() >= now,
    );

    const results = await Promise.all(
      needsAddress.map(async (b) => {
        const { data: addr } = await supabase.rpc('get_booking_address', { p_booking_id: b.id });
        return [b.id, (addr as string | null) ?? null] as const;
      }),
    );

    setProAddresses(Object.fromEntries(results));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings]),
  );

  async function respond(booking: Booking, accept: boolean) {
    setError(null);
    setAnsweringId(booking.id);

    const { error: respondError } = await supabase.rpc('respond_to_reschedule', {
      p_booking_id: booking.id,
      p_accept: accept,
    });

    setAnsweringId(null);

    if (respondError) {
      setError(respondError.message);
      return;
    }

    loadBookings();
  }

  async function answerPrice(booking: Booking, accept: boolean) {
    setError(null);
    setAnsweringId(booking.id);

    const { error: priceError } = await supabase.rpc('respond_to_price', {
      p_booking_id: booking.id,
      p_accept: accept,
    });

    setAnsweringId(null);

    if (priceError) {
      setError(priceError.code === 'P0001' ? priceError.message : "That didn't go through. Try again.");
      return;
    }

    loadBookings();
  }

  function declinePrice(booking: Booking) {
    Alert.alert(`Decline ${formatPrice(booking.proposed_price ?? 0)}?`, 'This cancels your booking.', [
      { text: 'Go back', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => answerPrice(booking, false) },
    ]);
  }

  function handleDecline(booking: Booking) {
    Alert.alert('Decline the new time?', 'This cancels your booking. You can always book again.', [
      { text: 'Go back', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => respond(booking, false) },
    ]);
  }

  async function keepBooking(booking: Booking) {
    setError(null);
    setAnsweringId(booking.id);

    const { error: keepError } = await supabase.rpc('dismiss_declined_change', { p_booking_id: booking.id });

    setAnsweringId(null);

    if (keepError) {
      setError("Couldn't update that. Check your connection and try again.");
      return;
    }

    loadBookings();
  }

  function openChangeTime(booking: Booking) {
    router.push({ pathname: '/customer/change/[bookingId]', params: { bookingId: String(booking.id) } });
  }

  function handleCancel(booking: Booking) {
    Alert.alert(
      'Cancel booking',
      `Cancel ${booking.services?.name ?? 'this booking'} on ${formatBookingTime(booking.starts_at)}?`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel booking',
          style: 'destructive',
          onPress: async () => {
            const { error: cancelError } = await supabase
              .from('bookings')
              .update({ status: 'cancelled' })
              .eq('id', booking.id);

            if (cancelError) {
              setError(cancelError.message);
              return;
            }

            loadBookings();
          },
        },
      ],
    );
  }

  const now = Date.now();
  const isFuture = (b: Booking) => new Date(b.starts_at).getTime() >= now;

  const isMyRequest = (b: Booking) =>
    isFuture(b) && (b.status === 'pending' || b.status === 'confirmed') && !!b.requested_starts_at;
  const isTheirSuggestion = (b: Booking) => b.status === 'reschedule_proposed' && isFuture(b);
  const isPriceWaiting = (b: Booking) => b.status === 'pending' && b.proposed_price !== null && isFuture(b);
  const isDeclined = (b: Booking) =>
    isFuture(b) &&
    (b.status === 'pending' || b.status === 'confirmed') &&
    !b.requested_starts_at &&
    !!b.declined_starts_at;

  const reschedules = bookings.filter((b) => isTheirSuggestion(b) || isMyRequest(b));
  const declined = bookings.filter(isDeclined);
  const confirmed = bookings.filter(
    (b) => b.status === 'confirmed' && isFuture(b) && !isMyRequest(b) && !isDeclined(b),
  );
  const pending = bookings.filter((b) => b.status === 'pending' && isFuture(b) && !isMyRequest(b) && !isDeclined(b));
  const cancelled = bookings.filter((b) => b.status === 'cancelled').reverse();
  const history = bookings
    .filter(
      (b) =>
        b.status !== 'cancelled' &&
        !reschedules.includes(b) &&
        !declined.includes(b) &&
        !confirmed.includes(b) &&
        !pending.includes(b),
    )
    .reverse();

  const sections = [
    { title: 'Reschedules', items: reschedules, needsAction: reschedules.filter(isTheirSuggestion).length },
    { title: 'Declined', items: declined, needsAction: declined.length },
    { title: 'Confirmed', items: confirmed, needsAction: 0 },
    { title: 'Pending', items: pending, needsAction: pending.filter(isPriceWaiting).length },
    { title: 'Cancelled', items: cancelled, needsAction: 0 },
    { title: 'History', items: history, needsAction: 0 },
  ]
    .filter((s) => s.items.length > 0)
    .map((s) => ({
      title: s.title,
      count: s.items.length,
      needsAction: s.needsAction,
      isOpen: openSections.has(s.title),
      data: openSections.has(s.title) ? s.items : [],
    }));

  if (loading) {
    return (
      <View style={ui.centered}>
        <ActivityIndicator size="large" color={colors.accentDark} />
      </View>
    );
  }

  return (
    <View style={ui.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={ui.content}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={error ? <Text style={ui.error}>{error}</Text> : null}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={40} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptyText}>When you book someone, it shows up here.</Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Pressable style={styles.sectionHeader} onPress={() => toggleSection(section.title)}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>
                {section.title} <Text style={styles.sectionCount}>({section.count})</Text>
              </Text>
              <CountBadge count={section.needsAction} />
            </View>
            <Ionicons name={section.isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
          </Pressable>
        )}
        renderItem={({ item }) => {
          const status = statusStyle(item.status, 'customer', colors);
          const future = isFuture(item);
          const isProposal = item.status === 'reschedule_proposed' && future;
          const canCancel = future && (item.status === 'pending' || item.status === 'confirmed');
          const isHome = item.location_type === 'at_customer';
          const usualPrice = Number(item.services?.price ?? 0);
          const servicePrice = item.agreed_price !== null ? Number(item.agreed_price) : usualPrice;
          const total = servicePrice + Number(item.call_out_fee);
          const priceWaiting = isPriceWaiting(item);
          const referenceUrl = referenceUrls[item.id];
          const answering = answeringId === item.id;
          const showProAddress = future && !isHome && item.status === 'confirmed';
          const proAddress = proAddresses[item.id];
          const faded = item.status === 'cancelled' || !future;
          const stylist = stylistName(item);
          const hasRequest = canCancel && !!item.requested_starts_at;
          const wasDeclined = isDeclined(item);
          const proFirstName = item.professionals?.first_name ?? 'them';
          const badge = priceWaiting
            ? { label: 'New price', color: colors.info, background: colors.infoSoft }
            : hasRequest
              ? { label: 'Change requested', color: colors.info, background: colors.infoSoft }
              : wasDeclined
                ? { label: 'Change declined', color: colors.danger, background: colors.dangerSoft }
                : status;

          return (
            <View style={[styles.card, isProposal && styles.proposalCard, faded && styles.fadedCard]}>
              <View style={styles.cardTop}>
                <Text style={styles.serviceName}>{item.services?.name ?? 'Service'}</Text>
                <View style={[styles.badge, { backgroundColor: badge.background }]}>
                  <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                </View>
              </View>

              <Pressable
                style={styles.personRow}
                onPress={() =>
                  router.push({ pathname: '/customer/professional/[id]', params: { id: item.professional_id } })
                }
                hitSlop={6}
              >
                <Avatar
                  name={item.professionals?.first_name ?? '?'}
                  url={professionalPhotoUrl(item.professionals?.avatar_path ?? null)}
                  size={28}
                />
                <Text style={styles.personName}>
                  {item.professionals?.first_name} {item.professionals?.last_name}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>

              {stylist && (
                <View style={styles.line}>
                  <Ionicons name="cut-outline" size={15} color={colors.textMuted} />
                  <Text style={styles.lineText}>With {stylist}</Text>
                </View>
              )}

              {isProposal && item.previous_starts_at ? (
                <>
                  <View style={styles.line}>
                    <Ionicons name="calendar-outline" size={15} color={colors.textFaint} />
                    <Text style={styles.oldTime}>{formatBookingTime(item.previous_starts_at)}</Text>
                  </View>
                  <View style={styles.line}>
                    <Ionicons name="arrow-forward" size={15} color={colors.text} />
                    <Text style={styles.newTime}>{formatBookingTime(item.starts_at)}</Text>
                  </View>
                  {item.change_reason ? <Text style={styles.reasonText}>Reason: {item.change_reason}</Text> : null}
                </>
              ) : (
                <View style={styles.line}>
                  <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
                  <Text style={styles.lineText}>{formatBookingTime(item.starts_at)}</Text>
                </View>
              )}

              {isHome && (
                <View style={styles.line}>
                  <Ionicons name="home-outline" size={15} color={colors.textMuted} />
                  <Text style={styles.lineText}>
                    {item.address ? `House call at ${shortAddress(item.address)}` : 'House call'}
                  </Text>
                </View>
              )}

              {referenceUrl && (
                <Pressable style={styles.referenceRow} onPress={() => setViewing(referenceUrl)}>
                  <Image source={{ uri: referenceUrl }} style={styles.referenceImage} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.referenceTitle}>{item.reference_path ? 'Your photo' : 'From their work'}</Text>
                    <Text style={styles.referenceHint}>Tap to see it bigger</Text>
                  </View>
                </Pressable>
              )}

              {priceWaiting && item.proposed_price !== null && (
                <View style={styles.requestBox}>
                  <Text style={styles.requestTime}>
                    {item.professionals?.first_name ?? 'They'} asked for {formatPrice(item.proposed_price)} (usually{' '}
                    {formatPrice(usualPrice)})
                  </Text>
                  {item.price_reason ? <Text style={styles.requestReason}>Reason: {item.price_reason}</Text> : null}
                </View>
              )}

              {hasRequest && item.requested_starts_at && (
                <View style={styles.requestBox}>
                  <Text style={styles.requestTime}>You asked for {formatBookingTime(item.requested_starts_at)}</Text>
                  {item.change_reason ? <Text style={styles.requestReason}>Reason: {item.change_reason}</Text> : null}
                  <Text style={styles.requestNote}>Waiting for {proFirstName} to reply.</Text>
                </View>
              )}

              {wasDeclined && item.declined_starts_at && (
                <View style={styles.requestBox}>
                  <Text style={styles.requestTime}>
                    {item.professionals?.first_name ?? 'They'} couldn't do {formatBookingTime(item.declined_starts_at)}.
                  </Text>
                  <Text style={styles.requestNote}>Your booking is still on the time above. Keep it or cancel it.</Text>
                </View>
              )}

              {showProAddress && (
                <View style={styles.addressBox}>
                  {proAddress ? (
                    <>
                      <Text style={styles.addressLabel}>Where to go</Text>
                      <Text style={styles.addressText}>{proAddress}</Text>
                      <Pressable style={styles.directionsButton} onPress={() => openDirections(proAddress)}>
                        <Ionicons name="navigate-outline" size={15} color={colors.text} />
                        <Text style={styles.directionsText}>Get directions</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Text style={styles.addressText}>
                      The address isn't showing yet. Message {item.professionals?.first_name ?? 'them'} for directions.
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.priceRow}>
                <Text style={styles.price}>{formatPrice(total)}</Text>
                {item.agreed_price !== null && Number(item.agreed_price) !== usualPrice && (
                  <Text style={styles.priceNote}>usually {formatPrice(usualPrice)}</Text>
                )}
                {isHome && Number(item.call_out_fee) > 0 && (
                  <Text style={styles.priceNote}>incl. {formatPrice(item.call_out_fee)} call-out</Text>
                )}
              </View>
              {item.agreed_price !== null && item.price_reason ? (
                <Text style={styles.priceReason}>{item.price_reason}</Text>
              ) : null}

              {answering && <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.accentDark} />}

              {!answering && isProposal && (
                <View style={styles.actions}>
                  <Pressable style={[styles.actionButton, styles.primary]} onPress={() => respond(item, true)}>
                    <Text style={styles.primaryText}>Accept</Text>
                  </Pressable>
                  <Pressable style={[styles.actionButton, styles.danger]} onPress={() => handleDecline(item)}>
                    <Text style={styles.dangerText}>Decline</Text>
                  </Pressable>
                </View>
              )}

              {!answering && priceWaiting && (
                <View style={styles.actions}>
                  <Pressable style={[styles.actionButton, styles.primary]} onPress={() => answerPrice(item, true)}>
                    <Text style={styles.primaryText}>Accept</Text>
                  </Pressable>
                  <Pressable style={[styles.actionButton, styles.danger]} onPress={() => declinePrice(item)}>
                    <Text style={styles.dangerText}>Decline</Text>
                  </Pressable>
                </View>
              )}

              {!answering && wasDeclined && (
                <>
                  <View style={styles.actions}>
                    <Pressable style={[styles.actionButton, styles.primary]} onPress={() => keepBooking(item)}>
                      <Text style={styles.primaryText}>Keep it</Text>
                    </Pressable>
                    <Pressable style={[styles.actionButton, styles.danger]} onPress={() => handleCancel(item)}>
                      <Text style={styles.dangerText}>Cancel booking</Text>
                    </Pressable>
                  </View>
                  <Pressable style={styles.tryAgainLink} onPress={() => openChangeTime(item)}>
                    <Text style={styles.tryAgainText}>Try a different time</Text>
                  </Pressable>
                </>
              )}

              {!answering && canCancel && !wasDeclined && !priceWaiting && (
                <View style={styles.linkRow}>
                  <Pressable style={styles.changeButton} onPress={() => openChangeTime(item)}>
                    <Ionicons name="time-outline" size={16} color={colors.text} />
                    <Text style={styles.changeText}>{hasRequest ? 'Ask for another time' : 'Change time'}</Text>
                  </Pressable>
                  <Pressable style={styles.cancelLink} onPress={() => handleCancel(item)}>
                    <Text style={styles.cancelText}>Cancel booking</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
      />

      <PhotoViewer
        photos={viewing ? [{ id: 0, url: viewing, caption: null }] : []}
        startIndex={viewing ? 0 : null}
        onClose={() => setViewing(null)}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  sectionCount: { fontFamily: fonts.regular, fontSize: 16, color: colors.textMuted },
  emptyBox: { alignItems: 'center', marginTop: 64, paddingHorizontal: spacing.xl },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginTop: spacing.md },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },
  proposalCard: { borderColor: colors.accentDark, borderWidth: 1.5 },
  fadedCard: { opacity: 0.7 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  serviceName: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  badge: { borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 },
  badgeText: { fontFamily: fonts.semiBold, fontSize: 12 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  personName: { flex: 1, fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  lineText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  oldTime: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textFaint,
    textDecorationLine: 'line-through',
  },
  newTime: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  reasonText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  referenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  referenceImage: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.accentSoft },
  referenceTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  referenceHint: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  priceReason: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted, marginTop: 2 },
  requestBox: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  requestTime: { fontFamily: fonts.semiBold, fontSize: 14, lineHeight: 20, color: colors.text },
  requestReason: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text, marginTop: 4 },
  requestNote: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted, marginTop: 4 },
  addressBox: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  addressLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  addressText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text, marginTop: 4 },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.accentDark,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginTop: spacing.md,
  },
  directionsText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.md },
  price: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  priceNote: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionButton: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5 },
  primary: { backgroundColor: colors.accentDark, borderColor: colors.accentDark },
  primaryText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.onAccent },
  danger: { borderColor: colors.danger, backgroundColor: colors.surface },
  dangerText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.danger },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.accentDark,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  changeText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  tryAgainLink: { alignSelf: 'flex-start', marginTop: spacing.md, paddingVertical: 4 },
  tryAgainText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, textDecorationLine: 'underline' },
  cancelLink: { paddingVertical: 4 },
  cancelText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.danger },
}));