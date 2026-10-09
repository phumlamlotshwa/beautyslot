import { Ionicons } from '@expo/vector-icons';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/avatar';
import { CountBadge } from '../../components/count-badge';
import { LocationBar } from '../../components/location-bar';
import { MessagesButton } from '../../components/messages-button';
import { professionLabels } from '../../lib/format';
import { CustomerLocation, distanceKm, formatDistance, getStartingLocation } from '../../lib/location';
import { customerPhotoUrls, professionalPhotoUrl } from '../../lib/photos';
import { supabase } from '../../lib/supabase';
import { fonts, radius, spacing } from '../../lib/theme';
import { makeStyles, useTheme } from '../../lib/theme-context';
import { useUi } from '../../lib/ui';

type Professional = {
  id: string;
  first_name: string;
  last_name: string;
  profession: string;
  location: string | null;
  approx_lat: number | null;
  approx_lng: number | null;
  avatar_path: string | null;
};

const filters = [
  { value: 'all', label: 'All' },
  { value: 'hairdresser', label: 'Hair' },
  { value: 'barber', label: 'Barber' },
  { value: 'nail_artist', label: 'Nails' },
  { value: 'makeup_artist', label: 'Makeup' },
];

const distances: { value: number | null; label: string }[] = [
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
  { value: null, label: 'Any distance' },
];

export default function CustomerHome() {
  const ui = useUi();
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [filter, setFilter] = useState('all');
  const [customerLocation, setCustomerLocation] = useState<CustomerLocation | null>(null);
  const [maxDistance, setMaxDistance] = useState<number | null>(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myName, setMyName] = useState('');
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [waitingCount, setWaitingCount] = useState(0);

  useEffect(() => {
    getStartingLocation().then((location) => {
      if (location) setCustomerLocation(location);
    });
  }, []);

  // The banner at the top is black, so the clock and battery are white here
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      return () => StatusBar.setBarStyle(scheme === 'dark' ? 'light-content' : 'dark-content');
    }, [scheme])
  );

  useFocusEffect(
    useCallback(() => {
      async function loadProfessionals() {
        setError(null);

        const { data, error: loadError } = await supabase
          .from('professionals')
          .select('id, first_name, last_name, profession, location, approx_lat, approx_lng, avatar_path, services!inner(id)')
          .order('first_name', { ascending: true });

        if (loadError) {
          setError(loadError.message);
        } else {
          setProfessionals((data ?? []) as unknown as Professional[]);
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: me } = await supabase.from('customers').select('first_name, avatar_path').eq('id', user.id).single();
          if (me) {
            setMyName(me.first_name);
            const urls = await customerPhotoUrls([me.avatar_path]);
            setMyAvatarUrl(me.avatar_path ? urls[me.avatar_path] ?? null : null);
          }

          // New times suggested by a professional, still waiting for Accept or Decline
          const { count } = await supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('customer_id', user.id)
            .eq('status', 'reschedule_proposed')
            .gte('starts_at', new Date().toISOString());

          setWaitingCount(count ?? 0);
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

  let emptyMessage = "Nobody's taking bookings here yet. Check back soon.";
  if (customerLocation && maxDistance !== null) {
    emptyMessage = `Nobody within ${maxDistance} km yet. Try a bigger distance.`;
  } else if (filter !== 'all') {
    emptyMessage = `No ${professionLabels[filter].toLowerCase()}s yet. Check back soon.`;
  }

  return (
    <View style={ui.screen}>
      <View style={[styles.banner, { paddingTop: insets.top + spacing.lg }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{myName ? `Hi ${myName}` : 'Hi'}</Text>
          <Text style={styles.bannerTitle}>Book someone near you</Text>
        </View>
        <Link href="/customer/profile" asChild>
          <Pressable hitSlop={8}>
            <Avatar name={myName || '?'} url={myAvatarUrl} size={44} />
          </Pressable>
        </Link>
      </View>

      <FlatList
        data={shownProfessionals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.topRow}>
              <Link href="/customer/bookings" asChild>
                <Pressable style={styles.topButton}>
                  <Ionicons name="calendar-outline" size={20} color={colors.text} />
                  <Text style={styles.topButtonText}>My bookings</Text>
                  <CountBadge count={waitingCount} />
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
                    <Text style={[styles.distanceText, maxDistance === d.value && styles.distanceTextSelected]}>
                      {d.label}
                    </Text>
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
              <Avatar name={item.first_name} url={professionalPhotoUrl(item.avatar_path)} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {item.first_name} {item.last_name}
                </Text>
                <Text style={styles.details}>
                  {professionLabels[item.profession] ?? item.profession}
                  {item.location ? ` in ${item.location}` : ''}
                </Text>
                {item.km !== null && <Text style={styles.distance}>{formatDistance(item.km)}</Text>}
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

const useStyles = makeStyles((colors) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    backgroundColor: colors.header,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  greeting: { fontFamily: fonts.regular, fontSize: 15, color: colors.onHeaderMuted },
  bannerTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.4,
    color: colors.onHeader,
    marginTop: 4,
  },
  content: { padding: spacing.xl, paddingBottom: 48 },
  topRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  topButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
  },
  topButtonText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  filters: { gap: spacing.sm, paddingBottom: spacing.md },
  distanceChip: { borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 14 },
  distanceChipSelected: { backgroundColor: colors.surface },
  distanceText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  distanceTextSelected: { fontFamily: fonts.semiBold, color: colors.text },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 23,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  details: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: 2 },
  distance: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text, marginTop: 6 },
  logOut: { alignItems: 'center', padding: spacing.lg, marginTop: spacing.lg },
  logOutText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted },
}));