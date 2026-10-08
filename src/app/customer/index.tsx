import { Ionicons } from '@expo/vector-icons';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LocationBar } from '../../components/location-bar';
import { MessagesButton } from '../../components/messages-button';
import { professionLabels } from '../../lib/format';
import { CustomerLocation, distanceKm, formatDistance, getStartingLocation } from '../../lib/location';
import { supabase } from '../../lib/supabase';
import { colors, fonts, radius, spacing } from '../../lib/theme';
import { ui } from '../../lib/ui';

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
    <View style={ui.screen}>
      <FlatList
        data={shownProfessionals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={ui.content}
        ListHeaderComponent={
          <>
            <Text style={ui.title}>Find a professional</Text>

            <View style={styles.topRow}>
              <Link href="/customer/bookings" asChild>
                <Pressable style={styles.topButton}>
                  <Ionicons name="calendar-outline" size={20} color={colors.accentDark} />
                  <Text style={styles.topButtonText}>My bookings</Text>
                </Pressable>
              </Link>
              <MessagesButton style={{ flex: 1 }} />
            </View>

            <LocationBar value={customerLocation} onChange={setCustomerLocation} />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {filters.map((f) => (
                <Pressable
                  key={f.value}
                  style={[ui.chip, filter === f.value && ui.chipSelected]}
                  onPress={() => setFilter(f.value)}
                >
                  <Text style={[ui.chipText, filter === f.value && ui.chipTextSelected]}>{f.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {customerLocation && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
                {distances.map((d) => (
                  <Pressable
                    key={d.label}
                    style={[styles.distanceChip, maxDistance === d.value && styles.distanceChipSelected]}
                    onPress={() => setMaxDistance(d.value)}
                  >
                    <Text style={[styles.distanceText, maxDistance === d.value && styles.distanceTextSelected]}>{d.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {error && <Text style={ui.error}>{error}</Text>}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.accentDark} />
          ) : (
            <Text style={styles.empty}>{emptyMessage}</Text>
          )
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/customer/professional/[id]', params: { id: item.id } }} asChild>
            <Pressable style={styles.card}>
              <View style={ui.avatar}>
                <Text style={ui.avatarText}>{item.first_name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {item.first_name} {item.last_name}
                </Text>
                <Text style={styles.details}>
                  {professionLabels[item.profession] ?? item.profession}
                  {item.location ? ` · ${item.location}` : ''}
                </Text>
                {item.km !== null && (
                  <View style={styles.distanceRow}>
                    <Ionicons name="location-outline" size={14} color={colors.accentDark} />
                    <Text style={styles.distance}>{formatDistance(item.km)}</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
            </Pressable>
          </Link>
        )}
        ListFooterComponent={
          <Pressable style={styles.logOut} onPress={handleLogOut}>
            <Text style={styles.logOutText}>Log out</Text>
          </Pressable>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  topButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
  },
  topButtonText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  filters: { gap: spacing.sm, paddingBottom: spacing.md },
  distanceChip: { borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 14, backgroundColor: 'transparent' },
  distanceChipSelected: { backgroundColor: colors.accentSoft },
  distanceText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  distanceTextSelected: { fontFamily: fonts.medium, color: colors.accentDark },
  empty: { fontFamily: fonts.regular, fontSize: 16, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  details: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: 2 },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  distance: { fontFamily: fonts.medium, fontSize: 13, color: colors.accentDark },
  logOut: { alignItems: 'center', padding: spacing.lg, marginTop: spacing.lg },
  logOutText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted },
});