import { Ionicons } from '@expo/vector-icons';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, SectionList, Text, View } from 'react-native';
import { Avatar } from '../../components/avatar';
import { ConfirmHomeVisit } from '../../components/confirm-home-visit';
import { CountBadge } from '../../components/count-badge';
import { formatPrice } from '../../lib/format';
import { customerPhotoUrls } from '../../lib/photos';
import { BookingStatus, statusStyle } from '../../lib/status';
import { supabase } from '../../lib/supabase';
import { fonts, radius, spacing } from '../../lib/theme';
import { makeStyles, useTheme } from '../../lib/theme-context';
import { useUi } from '../../lib/ui';

type Booking = {
  id: number;
  staff_id: number;
  staff: { name: string } | null;
  starts_at: string;
  status: BookingStatus;
  location_type: 'at_professional' | 'at_customer';
  address: string | null;
  address_lat: number | null;
  address_lng: number | null;
  call_out_fee: number;
  travel_minutes: number;
  services: { name: string; price: number } | null;
  customers: { first_name: string; last_name: string; avatar_path: string | null } | null;
};

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatBookingTime(iso: string) {
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()} at ${time}`;
}

export default function ProfessionalBookings() {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customerAvatars, setCustomerAvatars] = useState<Record<string, string>>({});
  const [staffFilter, setStaffFilter] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [homeVisit, setHomeVisit] = useState<Booking | null>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set(['Cancelled', 'History']));
  const [error, setError] = useState<string | null>(null);

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
        'id, staff_id, staff(name), starts_at, status, location_type, address, address_lat, address_lng, call_out_fee, travel_minutes, services(name, price), customers(first_name, last_name, avatar_path)'
      )
      .eq('professional_id', user.id)
      .order('starts_at', { ascending: true });

    if (loadError) {
      setError(loadError.message);
    } else {
      const list = (data ?? []) as unknown as Booking[];
      setBookings(list);
      setCustomerAvatars(await customerPhotoUrls(list.map((b) => b.customers?.avatar_path)));
    }

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings])
  );

  async function updateStatus(booking: Booking, status: BookingStatus) {
    setError(null);
    setUpdatingId(booking.id);

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', booking.id);

    setUpdatingId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    loadBookings();
  }

  async function confirmHomeVisit(travelMinutes: number) {
    if (!homeVisit) return;

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'confirmed', travel_minutes: travelMinutes })
      .eq('id', homeVisit.id);

    if (updateError) {
      if (updateError.code === '23P01') {
        throw new Error('With that travel buffer, this visit overlaps another booking. Try a shorter buffer, or suggest a new time.');
      }
      throw new Error(updateError.message);
    }

    setHomeVisit(null);
    loadBookings();
  }

  function handleConfirm(booking: Booking) {
    if (booking.location_type === 'at_customer') {
      setHomeVisit(booking);
    } else {
      updateStatus(booking, 'confirmed');
    }
  }

  function confirmCancel(booking: Booking, title: string) {
    Alert.alert(
      title,
      `${booking.services?.name ?? 'This booking'} with ${booking.customers?.first_name ?? 'the customer'} on ${formatBookingTime(booking.starts_at)}. The customer will see it as cancelled.`,
      [
        { text: 'Go back', style: 'cancel' },
        { text: title, style: 'destructive', onPress: () => updateStatus(booking, 'cancelled') },
      ]
    );
  }

  const now = Date.now();
  const isFuture = (b: Booking) => new Date(b.starts_at).getTime() >= now;

  const team = [...new Map(bookings.filter((b) => b.staff).map((b) => [b.staff_id, b.staff!.name])).entries()]
    .map(([id, name]) => ({ id, name }));

  // New requests waiting to be confirmed, for everyone or for one stylist
  const newCount = (staffId: number | 'all') =>
    bookings.filter(
      (b) => b.status === 'pending' && isFuture(b) && (staffId === 'all' || b.staff_id === staffId)
    ).length;

  const visible = staffFilter === 'all' ? bookings : bookings.filter((b) => b.staff_id === staffFilter);

  const newRequests = visible.filter((b) => b.status === 'pending' && isFuture(b));
  const confirmed = visible.filter((b) => b.status === 'confirmed' && isFuture(b));
  const waiting = visible.filter((b) => b.status === 'reschedule_proposed' && isFuture(b));
  const cancelled = visible.filter((b) => b.status === 'cancelled').reverse();
  const history = visible
    .filter(
      (b) =>
        b.status !== 'cancelled' &&
        !newRequests.includes(b) &&
        !confirmed.includes(b) &&
        !waiting.includes(b)
    )
    .reverse();

  const sections = [
    { title: 'New', items: newRequests },
    { title: 'Confirmed', items: confirmed },
    { title: 'Pending', items: waiting },
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
        ListHeaderComponent={
          <>
            {team.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
                <Pressable
                  style={[ui.chip, styles.chipRow, staffFilter === 'all' && ui.chipSelected]}
                  onPress={() => setStaffFilter('all')}
                >
                  <Text style={[ui.chipText, staffFilter === 'all' && ui.chipTextSelected]}>Everyone</Text>
                  <CountBadge count={newCount('all')} />
                </Pressable>
                {team.map((m) => (
                  <Pressable
                    key={m.id}
                    style={[ui.chip, styles.chipRow, staffFilter === m.id && ui.chipSelected]}
                    onPress={() => setStaffFilter(m.id)}
                  >
                    <Text style={[ui.chipText, staffFilter === m.id && ui.chipTextSelected]}>{m.name}</Text>
                    <CountBadge count={newCount(m.id)} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {error && <Text style={ui.error}>{error}</Text>}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={40} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptyText}>When customers book you, their requests show up here.</Text>
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
          const status = statusStyle(item.status, 'professional', colors);
          const future = isFuture(item);
          const busy = updatingId === item.id;
          const isHome = item.location_type === 'at_customer';
          const total = Number(item.services?.price ?? 0) + Number(item.call_out_fee);
          const isNew = item.status === 'pending' && future;
          const canMove = future && (item.status === 'pending' || item.status === 'confirmed' || item.status === 'reschedule_proposed');
          const canCancel = future && (item.status === 'confirmed' || item.status === 'reschedule_proposed');
          const canComplete = !future && item.status === 'confirmed';
          const faded = item.status === 'cancelled' || !future;

          return (
            <View style={[styles.card, faded && styles.fadedCard]}>
              <View style={styles.cardTop}>
                <Text style={styles.serviceName}>{item.services?.name ?? 'Service'}</Text>
                <View style={[styles.badge, { backgroundColor: status.background }]}>
                  <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>

              <View style={styles.personRow}>
                <Avatar
                  name={item.customers?.first_name ?? '?'}
                  url={customerAvatars[item.customers?.avatar_path ?? ''] ?? null}
                  size={28}
                />
                <Text style={styles.lineText}>
                  {item.customers?.first_name} {item.customers?.last_name}
                </Text>
              </View>
              <View style={styles.line}>
                <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
                <Text style={styles.lineText}>{formatBookingTime(item.starts_at)}</Text>
              </View>
              {team.length > 1 && (
                <View style={styles.line}>
                  <Ionicons name="cut-outline" size={15} color={colors.textMuted} />
                  <Text style={styles.lineText}>With {item.staff?.name}</Text>
                </View>
              )}

              {isHome && (
                <View style={styles.homeBox}>
                  <View style={styles.homeTitleRow}>
                    <Ionicons name="home-outline" size={15} color={colors.text} />
                    <Text style={styles.homeTitle}>House call</Text>
                  </View>
                  <Text style={styles.homeAddress}>{item.address}</Text>
                  {item.travel_minutes > 0 && (
                    <Text style={styles.homeDetail}>Travel buffer: {item.travel_minutes} min each way</Text>
                  )}
                </View>
              )}

              {item.status === 'reschedule_proposed' && future && (
                <Text style={styles.waitingText}>Waiting for the customer to accept this new time.</Text>
              )}

              <View style={styles.priceRow}>
                <Text style={styles.price}>{formatPrice(total)}</Text>
                {isHome && Number(item.call_out_fee) > 0 && (
                  <Text style={styles.priceNote}>incl. {formatPrice(item.call_out_fee)} call-out</Text>
                )}
              </View>

              {busy && <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.accentDark} />}

              {!busy && isNew && (
                <View style={styles.actions}>
                  <Pressable style={[styles.actionButton, styles.primary]} onPress={() => handleConfirm(item)}>
                    <Text style={styles.primaryText}>Confirm</Text>
                  </Pressable>
                  <Pressable style={[styles.actionButton, styles.danger]} onPress={() => confirmCancel(item, 'Decline')}>
                    <Text style={styles.dangerText}>Decline</Text>
                  </Pressable>
                </View>
              )}

              {!busy && canMove && (
                <Link href={{ pathname: '/professional/reschedule/[bookingId]', params: { bookingId: String(item.id) } }} asChild>
                  <Pressable style={styles.moveButton}>
                    <Ionicons name="time-outline" size={16} color={colors.text} />
                    <Text style={styles.moveText}>
                      {item.status === 'reschedule_proposed' ? 'Suggest a different time' : 'Suggest a new time'}
                    </Text>
                  </Pressable>
                </Link>
              )}

              {!busy && canCancel && (
                <Pressable style={styles.cancelLink} onPress={() => confirmCancel(item, 'Cancel booking')}>
                  <Text style={styles.cancelText}>Cancel booking</Text>
                </Pressable>
              )}

              {!busy && canComplete && (
                <Pressable style={styles.moveButton} onPress={() => updateStatus(item, 'completed')}>
                  <Ionicons name="checkmark-done-outline" size={16} color={colors.text} />
                  <Text style={styles.moveText}>Mark as completed</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />

      {homeVisit && homeVisit.address_lat !== null && homeVisit.address_lng !== null && (
        <ConfirmHomeVisit
          visible
          address={homeVisit.address ?? ''}
          destination={{ lat: homeVisit.address_lat, lng: homeVisit.address_lng }}
          onCancel={() => setHomeVisit(null)}
          onConfirm={confirmHomeVisit}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  filters: { gap: spacing.sm, paddingBottom: spacing.lg },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  fadedCard: { opacity: 0.7 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.xs },
  serviceName: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  badge: { borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 },
  badgeText: { fontFamily: fonts.semiBold, fontSize: 12 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  lineText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  homeBox: { backgroundColor: colors.background, borderRadius: radius.sm, padding: spacing.md, marginTop: spacing.md },
  homeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  homeTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  homeAddress: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text, marginTop: 4 },
  homeDetail: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 4 },
  waitingText: { fontFamily: fonts.medium, fontSize: 14, color: colors.info, marginTop: spacing.md },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.md },
  price: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  priceNote: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionButton: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5 },
  primary: { backgroundColor: colors.accentDark, borderColor: colors.accentDark },
  primaryText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.onAccent },
  danger: { borderColor: colors.danger, backgroundColor: colors.surface },
  dangerText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.danger },
  moveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.accentDark,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: spacing.md,
  },
  moveText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  cancelLink: { alignSelf: 'flex-start', marginTop: spacing.md, paddingVertical: 4 },
  cancelText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.danger },
}));