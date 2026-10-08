import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LocationBar } from '../../components/location-bar';
import { MessagesButton } from '../../components/messages-button';
import { professionLabels } from '../../lib/format';
import { CustomerLocation, distanceKm, formatDistance, getStartingLocation } from '../../lib/location';
import { supabase } from '../../lib/supabase';

type Professional = {
  id: string;
  first_name: string;
  last_name: string;
  profession: string;
  location: string | null;
  approx_lat: number | null;
  approx_lng: number | null;
};

const filters = [
  { value: 'all', label: 'All' },
  { value: 'barber', label: 'Barber' },
  { value: 'hairdresser', label: 'Hairdresser' },
  { value: 'makeup_artist', label: 'Makeup artist' },
  { value: 'nail_artist', label: 'Nail artist' },
];

const distances: { value: number | null; label: string }[] = [
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
  { value: null, label: 'Any distance' },
];

export default function CustomerHome() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [filter, setFilter] = useState('all');
  const [customerLocation, setCustomerLocation] = useState<CustomerLocation | null>(null);
  const [maxDistance, setMaxDistance] = useState<number | null>(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStartingLocation().then((location) => {
      if (location) setCustomerLocation(location);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      async function loadProfessionals() {
        setError(null);

        const { data, error: loadError } = await supabase
          .from('professionals')
          .select('id, first_name, last_name, profession, location, approx_lat, approx_lng, services!inner(id)')
          .order('first_name', { ascending: true });

        if (loadError) {
          setError(loadError.message);
        } else {
          setProfessionals((data ?? []) as unknown as Professional[]);
        }

        setLoading(false);
      }

      loadProfessionals();
    }, [])
  );

  const withDistance = professionals.map((p) => ({
    ...p,
    km:
      customerLocation && p.approx_lat !== null && p.approx_lng !== null
        ? distanceKm(customerLocation, { lat: p.approx_lat, lng: p.approx_lng })
        : null,
  }));

  const shownProfessionals = withDistance
    .filter((p) => filter === 'all' || p.profession === filter)
    .filter((p) => !customerLocation || maxDistance === null || (p.km !== null && p.km <= maxDistance))
    .sort((a, b) => {
      if (a.km === null && b.km === null) return 0;
      if (a.km === null) return 1;
      if (b.km === null) return -1;
      return a.km - b.km;
    });

  async function handleLogOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  let emptyMessage = 'No professionals yet. Check back soon.';
  if (customerLocation && maxDistance !== null) {
    emptyMessage = `No professionals within ${maxDistance} km yet. Try a bigger distance.`;
  } else if (filter !== 'all') {
    emptyMessage = `No ${professionLabels[filter].toLowerCase()}s yet. Check back soon.`;
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={shownProfessionals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Find a professional</Text>
            <Link href="/customer/bookings" asChild>
              <Pressable style={styles.outlineButton}>
                <Text style={styles.outlineButtonText}>My bookings</Text>
              </Pressable>
            </Link>
            <MessagesButton />

            <LocationBar value={customerLocation} onChange={setCustomerLocation} />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {filters.map((f) => (
                <Pressable
                  key={f.value}
                  style={[styles.chip, filter === f.value && styles.chipSelected]}
                  onPress={() => setFilter(f.value)}
                >
                  <Text style={[styles.chipText, filter === f.value && styles.chipTextSelected]}>{f.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {customerLocation && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
                {distances.map((d) => (
                  <Pressable
                    key={d.label}
                    style={[styles.chip, maxDistance === d.value && styles.chipSelected]}
                    onPress={() => setMaxDistance(d.value)}
                  >
                    <Text style={[styles.chipText, maxDistance === d.value && styles.chipTextSelected]}>{d.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 32 }} color="#000000" />
          ) : (
            <Text style={styles.empty}>{emptyMessage}</Text>
          )
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/customer/professional/[id]', params: { id: item.id } }} asChild>
            <Pressable style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.first_name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {item.first_name} {item.last_name}
                </Text>
                <Text style={styles.details}>
                  {professionLabels[item.profession] ?? item.profession}
                  {item.location ? ` · ${item.location}` : ''}
                </Text>
                {item.km !== null && <Text style={styles.distance}>{formatDistance(item.km)}</Text>}
              </View>
            </Pressable>
          </Link>
        )}
        ListFooterComponent={
          <Pressable style={styles.secondaryButton} onPress={handleLogOut}>
            <Text style={styles.secondaryButtonText}>Log out</Text>
          </Pressable>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: '700', color: '#000000', marginBottom: 16 },
  outlineButton: { borderWidth: 1, borderColor: '#000000', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 12 },
  outlineButtonText: { color: '#000000', fontSize: 16, fontWeight: '600' },
  filters: { gap: 8, paddingBottom: 16 },
  chip: { borderWidth: 1, borderColor: '#cccccc', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16 },
  chipSelected: { backgroundColor: '#000000', borderColor: '#000000' },
  chipText: { color: '#000000' },
  chipTextSelected: { color: '#ffffff' },
  error: { color: '#c62828', marginBottom: 16 },
  empty: { fontSize: 16, color: '#666666', textAlign: 'center', marginTop: 32 },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#eeeeee', borderRadius: 12, padding: 16, marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '600', color: '#000000' },
  details: { fontSize: 14, color: '#666666', marginTop: 4 },
  distance: { fontSize: 13, color: '#1b7a3d', fontWeight: '600', marginTop: 4 },
  secondaryButton: { borderWidth: 1, borderColor: '#000000', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 24 },
  secondaryButtonText: { color: '#000000', fontSize: 16, fontWeight: '600' },
});