import { Ionicons } from '@expo/vector-icons';
import { Link, router, useFocusEffect } from 'expo-router';
import { ComponentProps, useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MessagesButton } from '../../components/messages-button';
import { formatDuration, formatPrice, OfferedAt, offeredAtLabels } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { colors, fonts, radius, spacing } from '../../lib/theme';
import { ui } from '../../lib/ui';

type Service = {
  id: number;
  name: string;
  category: string;
  offered_at: OfferedAt;
  price: number;
  duration_minutes: number;
};

type IconName = ComponentProps<typeof Ionicons>['name'];

function Tile({ href, icon, label, count }: { href: '/professional/bookings' | '/professional/hours' | '/professional/home-visits' | '/professional/profile'; icon: IconName; label: string; count?: number }) {
return (
    <Link href={href} asChild>
      <Pressable style={styles.tile}>
        <Ionicons name={icon} size={24} color={colors.accentDark} />
        <Text style={styles.tileText}>{label}</Text>
        {count ? (
          <View style={styles.tileBadge}>
            <Text style={styles.tileBadgeText}>{count > 99 ? '99+' : count}</Text>
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}

export default function ProfessionalHome() {
  const [services, setServices] = useState<Service[]>([]);
  const [newRequests, setNewRequests] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      async function loadHome() {
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const [{ data, error: loadError }, { count }] = await Promise.all([
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
            .gte('starts_at', new Date().toISOString()),
        ]);

        if (loadError) {
          setError(loadError.message);
        } else {
          setServices((data ?? []) as Service[]);
        }

        setNewRequests(count ?? 0);
        setLoading(false);
      }

      loadHome();
    }, [])
  );

  async function handleLogOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  return (
    <View style={ui.screen}>
      <FlatList
        data={services}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={ui.content}
        ListHeaderComponent={
          <>
                      <Link href="/professional/profile" asChild>
              <Pressable style={styles.profileRow}>
                <Ionicons name="person-circle-outline" size={28} color={colors.accentDark} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileTitle}>My profile</Text>
                  <Text style={styles.profileHint}>Your photo and pictures of your work</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </Pressable>
            </Link>
            <View style={styles.grid}>
              <Tile href="/professional/bookings" icon="calendar-outline" label="Bookings" count={newRequests} />
              <MessagesButton style={styles.messagesTile} />
              <Tile href="/professional/hours" icon="time-outline" label="Working hours" />
              <Tile href="/professional/home-visits" icon="car-outline" label="Home visits" />
            </View>

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
              <Text style={styles.emptyText}>Customers can only find and book you once you have at least one service.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/professional/service/[id]', params: { id: String(item.id) } }} asChild>
            <Pressable style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceName}>{item.name}</Text>
                <Text style={styles.serviceDetails}>
                  {item.category} · {formatDuration(item.duration_minutes)}
                </Text>
                {item.offered_at !== 'at_professional' && (
                  <View style={styles.homeTag}>
                    <Ionicons name="home-outline" size={12} color={colors.accentDark} />
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

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  tile: { width: '48%', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 18 },
  messagesTile: { width: '48%', flexDirection: 'column', gap: 6, paddingVertical: 18 },
  tileText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  tileBadge: { position: 'absolute', top: 10, right: 10, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.accentDark, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  tileBadgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.onAccent },
  servicesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.md },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accentDark, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14 },
  addText: { fontFamily: fonts.medium, fontSize: 14, color: colors.onAccent },
  emptyBox: { alignItems: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, marginTop: spacing.md },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  serviceName: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  serviceDetails: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: 2 },
  homeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 8, marginTop: spacing.sm },
  homeTagText: { fontFamily: fonts.medium, fontSize: 12, color: colors.accentDark },
  price: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  logOut: { alignItems: 'center', padding: spacing.lg, marginTop: spacing.lg },
  logOutText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted },
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },
  profileTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  profileHint: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 2 },
});