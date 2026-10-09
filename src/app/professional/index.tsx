import { Ionicons } from '@expo/vector-icons';
import { Link, router, useFocusEffect } from 'expo-router';
import { ComponentProps, useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StatusBar, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/avatar';
import { CountBadge } from '../../components/count-badge';
import { MessagesButton } from '../../components/messages-button';
import { formatDuration, formatPrice, OfferedAt, offeredAtLabels } from '../../lib/format';
import { professionalPhotoUrl } from '../../lib/photos';
import { supabase } from '../../lib/supabase';
import { fonts, radius, spacing } from '../../lib/theme';
import { makeStyles, useTheme } from '../../lib/theme-context';
import { useUi } from '../../lib/ui';

type Service = {
  id: number;
  name: string;
  category: string;
  offered_at: OfferedAt;
  price: number;
  duration_minutes: number;
};

type IconName = ComponentProps<typeof Ionicons>['name'];

type TileProps = {
  href: '/professional/bookings' | '/professional/hours' | '/professional/home-visits' | '/professional/profile';
  icon: IconName;
  label: string;
  count?: number;
};

function Tile({ href, icon, label, count = 0 }: TileProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <Link href={href} asChild>
      <Pressable style={styles.tile}>
        <Ionicons name={icon} size={24} color={colors.text} />
        <Text style={styles.tileText}>{label}</Text>
        {count > 0 && (
          <View style={styles.tileBadge}>
            <CountBadge count={count} />
          </View>
        )}
      </Pressable>
    </Link>
  );
}

export default function ProfessionalHome() {
  const ui = useUi();
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();

  const [services, setServices] = useState<Service[]>([]);
  const [newRequests, setNewRequests] = useState(0);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [firstName, setFirstName] = useState('');
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      return () => StatusBar.setBarStyle(scheme === 'dark' ? 'light-content' : 'dark-content');
    }, [scheme]),
  );

  useFocusEffect(
    useCallback(() => {
      async function loadHome() {
        setError(null);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const now = new Date().toISOString();
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startOfTomorrow = new Date(startOfToday);
        startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

        const [{ data, error: loadError }, { count: pending }, { count: changes }, { count: today }, { data: me }] =
          await Promise.all([
            supabase
              .from('services')
              .select('id, name, category, offered_at, price, duration_minutes')
              .eq('professional_id', user.id)
              .order('created_at', { ascending: true }),
            supabase
              .from('bookings')
              .select('id', { count: 'exact', head: true })
              .eq('professional_id', user.id)
              .eq('status', 'pending')
              .gte('starts_at', now),
            supabase
              .from('bookings')
              .select('id', { count: 'exact', head: true })
              .eq('professional_id', user.id)
              .eq('status', 'confirmed')
              .not('requested_starts_at', 'is', null)
              .gte('starts_at', now),
            supabase
              .from('bookings')
              .select('id', { count: 'exact', head: true })
              .eq('professional_id', user.id)
              .eq('status', 'confirmed')
              .gte('starts_at', startOfToday.toISOString())
              .lt('starts_at', startOfTomorrow.toISOString()),
            supabase.from('professionals').select('first_name, avatar_path').eq('id', user.id).single(),
          ]);

        if (loadError) {
          setError(loadError.message);
        } else {
          setServices((data ?? []) as Service[]);
        }

        setNewRequests((pending ?? 0) + (changes ?? 0));
        setTodayCount(today ?? 0);
        if (me) {
          setFirstName(me.first_name);
          setAvatarPath(me.avatar_path);
        }
        setLoading(false);
      }

      loadHome();
    }, []),
  );

  async function handleLogOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  let todayText = ' ';
  if (todayCount !== null) {
    todayText =
      todayCount === 0 ? 'Nothing booked for today' : `${todayCount} booking${todayCount === 1 ? '' : 's'} today`;
  }

  return (
    <View style={ui.screen}>
      <View style={[styles.banner, { paddingTop: insets.top + spacing.lg }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{firstName ? `Hi ${firstName}` : 'Hi'}</Text>
          <Text style={styles.bannerTitle}>{todayText}</Text>
        </View>
        <Link href="/professional/profile" asChild>
          <Pressable hitSlop={8}>
            <Avatar name={firstName || '?'} url={professionalPhotoUrl(avatarPath)} size={44} />
          </Pressable>
        </Link>
      </View>

      <FlatList
        data={services}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.grid}>
              <Tile href="/professional/bookings" icon="calendar-outline" label="Bookings" count={newRequests} />
              <MessagesButton variant="tile" style={styles.messagesTile} />
              <Tile href="/professional/hours" icon="time-outline" label="Working hours" />
              <Tile href="/professional/home-visits" icon="car-outline" label="House calls" />
            </View>

            <Link href="/professional/profile" asChild>
              <Pressable style={styles.linkRow}>
                <Ionicons name="images-outline" size={22} color={colors.text} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkTitle}>My profile</Text>
                  <Text style={styles.linkHint}>Your photo and pictures of your work</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </Pressable>
            </Link>
            <Link href="/professional/team" asChild>
              <Pressable style={styles.linkRow}>
                <Ionicons name="people-outline" size={22} color={colors.text} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkTitle}>My team</Text>
                  <Text style={styles.linkHint}>Who takes bookings and what they do</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </Pressable>
            </Link>

            <View style={styles.servicesHeader}>
              <Text style={styles.sectionTitle}>My services</Text>
              <Link href="/professional/add-service" asChild>
                <Pressable style={styles.addButton}>
                  <Ionicons name="add" size={18} color={colors.onAccent} />
                  <Text style={styles.addText}>Add</Text>
                </Pressable>
              </Link>
            </View>

            {error && <Text style={ui.error}>{error}</Text>}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.accentDark} />
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="cut-outline" size={36} color={colors.textFaint} />
              <Text style={styles.emptyTitle}>Add your first service</Text>
              <Text style={styles.emptyText}>Customers can find and book you once you have at least one service.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/professional/service/[id]', params: { id: String(item.id) } }} asChild>
            <Pressable style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceName}>{item.name}</Text>
                <Text style={styles.serviceDetails}>{formatDuration(item.duration_minutes)}</Text>
                {item.offered_at !== 'at_professional' && (
                  <View style={styles.homeTag}>
                    <Ionicons name="home-outline" size={12} color={colors.text} />
                    <Text style={styles.homeTagText}>{offeredAtLabels[item.offered_at]}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.price}>{formatPrice(item.price)}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
    marginBottom: spacing.lg,
  },
  tile: {
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 18,
  },
  messagesTile: { width: '48%' },
  tileText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  tileBadge: { position: 'absolute', top: 10, right: 10 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  linkTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  linkHint: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  servicesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentDark,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  addText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.onAccent },
  emptyBox: { alignItems: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, marginTop: spacing.md },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  serviceName: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  serviceDetails: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: 2 },
  homeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginTop: spacing.sm,
  },
  homeTagText: { fontFamily: fonts.medium, fontSize: 12, color: colors.text },
  price: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  logOut: { alignItems: 'center', padding: spacing.lg, marginTop: spacing.lg },
  logOutText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted },
}));