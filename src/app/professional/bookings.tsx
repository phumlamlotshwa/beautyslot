import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { formatPrice } from '../../lib/format';
import { supabase } from '../../lib/supabase';

type Status = 'pending' | 'confirmed' | 'cancelled' | 'completed';

type Booking = {
  id: number;
  starts_at: string;
  status: Status;
  services: { name: string; price: number } | null;
  customers: { first_name: string; last_name: string } | null;
};

const statusStyles: Record<Status, { label: string; color: string; background: string }> = {
  pending: { label: 'Pending', color: '#b26a00', background: '#fff4e0' },
  confirmed: { label: 'Confirmed', color: '#1b7a3d', background: '#e6f6ec' },
  cancelled: { label: 'Cancelled', color: '#777777', background: '#f0f0f0' },
  completed: { label: 'Completed', color: '#1f4fa3', background: '#e8eefa' },
};

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatBookingTime(iso: string) {
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()} at ${time}`;
}

export default function ProfessionalBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
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
      .select('id, starts_at, status, services(name, price), customers(first_name, last_name)')
      .eq('professional_id', user.id)
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

  async function updateStatus(booking: Booking, status: Status) {
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
  const isUpcoming = (b: Booking) => new Date(b.starts_at).getTime() >= now;

  const waiting = bookings.filter((b) => b.status === 'pending' && isUpcoming(b));
  const upcoming = bookings.filter((b) => b.status === 'confirmed' && isUpcoming(b));
  const past = bookings.filter((b) => !waiting.includes(b) && !upcoming.includes(b)).reverse();

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
          { title: 'Waiting for you', data: waiting, empty: 'No new requests.' },
          { title: 'Upcoming', data: upcoming, empty: 'No confirmed bookings coming up.' },
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
          const status = statusStyles[item.status];
          const busy = updatingId === item.id;
          const canComplete = section.title === 'Past and cancelled' && item.status === 'confirmed';

          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.serviceName}>{item.services?.name ?? 'Service'}</Text>
                <View style={[styles.badge, { backgroundColor: status.background }]}>
                  <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>
              <Text style={styles.details}>
                {item.customers?.first_name} {item.customers?.last_name}
              </Text>
              <Text style={styles.details}>{formatBookingTime(item.starts_at)}</Text>
              {item.services && <Text style={styles.price}>{formatPrice(item.services.price)}</Text>}

              {busy && <ActivityIndicator style={{ marginTop: 12 }} color="#000000" />}

              {!busy && section.title === 'Waiting for you' && (
                <View style={styles.actions}>
                  <Pressable style={[styles.actionButton, styles.primary]} onPress={() => updateStatus(item, 'confirmed')}>
                    <Text style={styles.primaryText}>Confirm</Text>
                  </Pressable>
                  <Pressable style={[styles.actionButton, styles.danger]} onPress={() => confirmCancel(item, 'Decline')}>
                    <Text style={styles.dangerText}>Decline</Text>
                  </Pressable>
                </View>
              )}

              {!busy && section.title === 'Upcoming' && (
                <Pressable style={[styles.actionButton, styles.danger, { marginTop: 12 }]} onPress={() => confirmCancel(item, 'Cancel booking')}>
                  <Text style={styles.dangerText}>Cancel booking</Text>
                </Pressable>
              )}

              {!busy && canComplete && (
                <Pressable style={[styles.actionButton, styles.outline, { marginTop: 12 }]} onPress={() => updateStatus(item, 'completed')}>
                  <Text style={styles.outlineText}>Mark as completed</Text>
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
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  serviceName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#000000' },
  badge: { borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  details: { fontSize: 14, color: '#666666', marginTop: 4 },
  price: { fontSize: 15, fontWeight: '600', color: '#000000', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionButton: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1 },
  primary: { backgroundColor: '#000000', borderColor: '#000000' },
  primaryText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  danger: { borderColor: '#c62828' },
  dangerText: { color: '#c62828', fontSize: 15, fontWeight: '600' },
  outline: { borderColor: '#000000' },
  outlineText: { color: '#000000', fontSize: 15, fontWeight: '600' },
});