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
  professionals: { first_name: string; last_name: string } | null;
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

export default function MyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
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
      .select('id, starts_at, status, services(name, price), professionals(first_name, last_name)')
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
    (b) => new Date(b.starts_at).getTime() >= now && (b.status === 'pending' || b.status === 'confirmed')
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
          const status = statusStyles[item.status];
          const canCancel = section.title === 'Upcoming';

          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.serviceName}>{item.services?.name ?? 'Service'}</Text>
                <View style={[styles.badge, { backgroundColor: status.background }]}>
                  <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>
              <Text style={styles.details}>
                with {item.professionals?.first_name} {item.professionals?.last_name}
              </Text>
              <Text style={styles.details}>{formatBookingTime(item.starts_at)}</Text>
              {item.services && <Text style={styles.price}>{formatPrice(item.services.price)}</Text>}

              {canCancel && (
                <Pressable style={styles.cancelButton} onPress={() => handleCancel(item)}>
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
  cancelButton: { borderWidth: 1, borderColor: '#c62828', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 12 },
  cancelText: { color: '#c62828', fontSize: 15, fontWeight: '600' },
});