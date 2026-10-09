import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, SectionList, Text, View } from 'react-native';
import { formatPrice } from '../../lib/format';
import { BookingStatus, statusStyle } from '../../lib/status';
import { supabase } from '../../lib/supabase';
import { fonts, radius, spacing } from '../../lib/theme';
import { makeStyles, useTheme } from '../../lib/theme-context';
import { useUi } from '../../lib/ui';
import { Avatar } from '../../components/avatar';
import { professionalPhotoUrl } from '../../lib/photos';
import { shortAddress } from '../../lib/location';

type Booking = {
  id: number;
  starts_at: string;
  previous_starts_at: string | null;
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

// A solo professional's one team member usually has their own name,
// so only show "With ..." when the stylist is someone else.
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
  const [closed, setClosed] = useState<Set<string>>(new Set(['Cancelled', 'History']));

  function toggleSection(title: string) {
    setClosed((current) => {
      const next = new Set(current);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }

  const loadBookings = useCallback(async () => {
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error: loadError } = await supabase
      .from('bookings')
      .select(
        'id, starts_at, previous_starts_at, status, location_type, address, call_out_fee, services(name, price), professionals(first_name, last_name, avatar_path), staff(name)'
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

    const now = Date.now();
    const needsAddress = loaded.filter(
      (b) =>
        b.status === 'confirmed' &&
        b.location_type === 'at_professional' &&
        new Date(b.starts_at).getTime() >= now
    );

    const results = await Promise.all(
      needsAddress.map(async (b) => {
        const { data: addr } = await supabase.rpc('get_booking_address', { p_booking_id: b.id });
        return [b.id, (addr as string | null) ?? null] as const;
      })
    );

    setProAddresses(Object.fromEntries(results));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings])
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

  function handleDecline(booking: Booking) {
    Alert.alert(
      'Decline the new time?',
      'Your booking will be cancelled. You can book a different time afterwards.',
      [
        { text: 'Go back', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: () => respond(booking, false) },
      ]
    );
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
      ]
    );
  }

  const now = Date.now();
  const isFuture = (b: Booking) => new Date(b.starts_at).getTime() >= now;

  const confirmed = bookings.filter((b) => b.status === 'confirmed' && isFuture(b));
  const pending = bookings.filter(
    (b) => (b.status === 'pending' || b.status === 'reschedule_proposed') && isFuture(b)
  );
  const cancelled = bookings.filter((b) => b.status === 'cancelled').reverse();
  const history = bookings
    .filter((b) => b.status !== 'cancelled' && !confirmed.includes(b) && !pending.includes(b))
    .reverse();

  const sections = [
    { title: 'Confirmed', items: confirmed },
    { title: 'Pending', items: pending },
    { title: 'Cancelled', items: cancelled },
    { title: 'History', items: history },
  ]
    .filter((s) => s.items.length > 0)
    .map((s) => ({
      title: s.title,
      count: s.items.length,
      isOpen: !closed.has(s.title),
      data: closed.has(s.title) ? [] : s.items,
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
            <Text style={styles.sectionTitle}>
              {section.title} <Text style={styles.sectionCount}>({section.count})</Text>
            </Text>
            <Ionicons name={section.isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
          </Pressable>
        )}
        renderItem={({ item }) => {
          const status = statusStyle(item.status, 'customer', colors);
          const future = isFuture(item);
          const isProposal = item.status === 'reschedule_proposed' && future;
          const canCancel = future && (item.status === 'pending' || item.status === 'confirmed');
          const isHome = item.location_type === 'at_customer';
          const total = Number(item.services?.price ?? 0) + Number(item.call_out_fee);
          const answering = answeringId === item.id;
          const showProAddress = future && !isHome && item.status === 'confirmed';
          const proAddress = proAddresses[item.id];
          const faded = item.status === 'cancelled' || !future;
          const stylist = stylistName(item);

          return (
            <View style={[styles.card, isProposal && styles.proposalCard, faded && styles.fadedCard]}>
              <View style={styles.cardTop}>
                <Text style={styles.serviceName}>{item.services?.name ?? 'Service'}</Text>
                <View style={[styles.badge, { backgroundColor: status.background }]}>
                  <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>

              <View style={styles.personRow}>
                <Avatar
                  name={item.professionals?.first_name ?? '?'}
                  url={professionalPhotoUrl(item.professionals?.avatar_path ?? null)}
                  size={28}
                />
                <Text style={styles.lineText}>
                  {item.professionals?.first_name} {item.professionals?.last_name}
                </Text>
              </View>

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
                    <Ionicons name="arrow-forward" size={15} color={colors.info} />
                    <Text style={styles.newTime}>{formatBookingTime(item.starts_at)}</Text>
                  </View>
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
                    {item.address ? `At ${shortAddress(item.address)}` : 'At your home'}
                  </Text>
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
                {isHome && Number(item.call_out_fee) > 0 && (
                  <Text style={styles.priceNote}>incl. {formatPrice(item.call_out_fee)} call-out</Text>
                )}
              </View>

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

              {!answering && canCancel && (
                <Pressable style={styles.cancelLink} onPress={() => handleCancel(item)}>
                  <Text style={styles.cancelText}>Cancel booking</Text>
                </Pressable>
              )}
            </View>
          );
        }}
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
  sectionTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  sectionCount: { fontFamily: fonts.regular, fontSize: 16, color: colors.textMuted },
  emptyBox: { alignItems: 'center', marginTop: 64, paddingHorizontal: spacing.xl },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginTop: spacing.md },
  emptyText: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },
  proposalCard: { borderColor: colors.info, borderWidth: 2 },
  fadedCard: { opacity: 0.7 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.xs },
  serviceName: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  badge: { borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 },
  badgeText: { fontFamily: fonts.semiBold, fontSize: 12 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  lineText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  oldTime: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.textFaint, textDecorationLine: 'line-through' },
  newTime: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.info },
  addressBox: { backgroundColor: colors.background, borderRadius: radius.sm, padding: spacing.md, marginTop: spacing.md },
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
  cancelLink: { alignSelf: 'flex-start', marginTop: spacing.md, paddingVertical: 4 },
  cancelText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.danger },
}));