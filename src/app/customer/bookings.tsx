import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { formatPrice } from '../../lib/format';
import { supabase } from '../../lib/supabase';

type Status = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'reschedule_proposed';

type Booking = {
  id: number;
  starts_at: string;
  previous_starts_at: string | null;
  status: Status;
  location_type: 'at_professional' | 'at_customer';
  address: string | null;
  call_out_fee: number;
  services: { name: string; price: number } | null;
  professionals: { first_name: string; last_name: string } | null;
};

const statusStyles: Record<Status, { label: string; color: string; background: string }> = {
  pending: { label: 'Pending', color: '#b26a00', background: '#fff4e0' },
  confirmed: { label: 'Confirmed', color: '#1b7a3d', background: '#e6f6ec' },
  cancelled: { label: 'Cancelled', color: '#777777', background: '#f0f0f0' },
  completed: { label: 'Completed', color: '#1f4fa3', background: '#e8eefa' },
  reschedule_proposed: { label: 'New time suggested', color: '#6a3fb5', background: '#f1ebfb' },
};

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatBookingTime(iso: string) {
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()} at ${time}`;
}

export default function MyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [answeringId, setAnsweringId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        'id, starts_at, previous_starts_at, status, location_type, address, call_out_fee, services(name, price), professionals(first_name, last_name)'
      )
      .eq('customer_id', user.id)
      .order('starts_at', { ascending: true });

    if (loadError) {
      setError(loadError.message);
    } else {
      setBookings((data ?? []) as unknown as Booking[]);
    }

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
  const upcoming = bookings.filter(
    (b) =>
      new Date(b.starts_at).getTime() >= now &&
      (b.status === 'pending' || b.status === 'confirmed' || b.status === 'reschedule_proposed')
  );
  const past = bookings.filter((b) => !upcoming.includes(b)).reverse();

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SectionList
        sections={[
          { title: 'Upcoming', data: upcoming, empty: "You don't have any upcoming bookings." },
          { title: 'Past and cancelled', data: past, empty: 'Nothing here yet.' },
        ]}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? <Text style={styles.empty}>{section.empty}</Text> : null
        }
        renderItem={({ item, section }) => {
          const status = statusStyles[item.status] ?? statusStyles.pending;
          const isUpcoming = section.title === 'Upcoming';
          const isProposal = item.status === 'reschedule_proposed';
          const isHome = item.location_type === 'at_customer';
          const total = Number(item.services?.price ?? 0) + Number(item.call_out_fee);
          const answering = answeringId === item.id;

          return (
            <View style={[styles.card, isProposal && isUpcoming && styles.proposalCard]}>
              <View style={styles.cardTop}>
                <Text style={styles.serviceName}>{item.services?.name ?? 'Service'}</Text>
                <View style={[styles.badge, { backgroundColor: status.background }]}>
                  <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>
              <Text style={styles.details}>
                with {item.professionals?.first_name} {item.professionals?.last_name}
              </Text>

              {isProposal && isUpcoming && item.previous_starts_at ? (
                <>
                  <Text style={styles.oldTime}>{formatBookingTime(item.previous_starts_at)}</Text>
                  <Text style={styles.newTime}>New time: {formatBookingTime(item.starts_at)}</Text>
                </>
              ) : (
                <Text style={styles.details}>{formatBookingTime(item.starts_at)}</Text>
              )}

              {isHome && <Text style={styles.details}>At your home: {item.address}</Text>}

              <Text style={styles.price}>
                {formatPrice(total)}
                {isHome && Number(item.call_out_fee) > 0 ? ` (incl. ${formatPrice(item.call_out_fee)} call-out)` : ''}
              </Text>

              {answering && <ActivityIndicator style={{ marginTop: 12 }} color="#000000" />}

              {!answering && isUpcoming && isProposal && (
                <View style={styles.actions}>
                  <Pressable style={[styles.actionButton, styles.primary]} onPress={() => respond(item, true)}>
                    <Text style={styles.primaryText}>Accept</Text>
                  </Pressable>
                  <Pressable style={[styles.actionButton, styles.danger]} onPress={() => handleDecline(item)}>
                    <Text style={styles.dangerText}>Decline</Text>
                  </Pressable>
                </View>
              )}

              {!answering && isUpcoming && !isProposal && (
                <Pressable style={[styles.actionButton, styles.danger, { marginTop: 12 }]} onPress={() => handleCancel(item)}>
                  <Text style={styles.dangerText}>Cancel booking</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 24, paddingBottom: 48 },
  error: { color: '#c62828', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000000', marginTop: 8, marginBottom: 12 },
  empty: { fontSize: 15, color: '#666666', marginBottom: 24 },
  card: { borderWidth: 1, borderColor: '#eeeeee', borderRadius: 12, padding: 16, marginBottom: 12 },
  proposalCard: { borderColor: '#6a3fb5', borderWidth: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  serviceName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#000000' },
  badge: { borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  details: { fontSize: 14, color: '#666666', marginTop: 4 },
  oldTime: { fontSize: 14, color: '#999999', marginTop: 4, textDecorationLine: 'line-through' },
  newTime: { fontSize: 15, color: '#6a3fb5', fontWeight: '700', marginTop: 4 },
  price: { fontSize: 15, fontWeight: '600', color: '#000000', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionButton: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1 },
  primary: { backgroundColor: '#000000', borderColor: '#000000' },
  primaryText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  danger: { borderColor: '#c62828' },
  dangerText: { color: '#c62828', fontSize: 15, fontWeight: '600' },
});