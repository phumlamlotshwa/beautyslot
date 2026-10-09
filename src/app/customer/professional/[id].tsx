import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { Avatar } from '../../../components/avatar';
import { PhotoViewer } from '../../../components/photo-viewer';
import { getOrCreateConversation } from '../../../lib/chat';
import { formatDuration, formatPrice, OfferedAt, offeredAtLabels, professionLabels } from '../../../lib/format';
import { professionalPhotoUrl } from '../../../lib/photos';
import { supabase } from '../../../lib/supabase';
import { fonts, radius, spacing } from '../../../lib/theme';
import { makeStyles, useTheme } from '../../../lib/theme-context';
import { useUi } from '../../../lib/ui';

type Service = {
  id: number;
  name: string;
  category: string;
  offered_at: OfferedAt;
  price: number;
  duration_minutes: number;
};

type Professional = {
  id: string;
  first_name: string;
  last_name: string;
  profession: string;
  location: string | null;
  avatar_path: string | null;
  services: Service[];
};

type Catalogue = { id: number; name: string };
type WorkPhoto = { id: number; path: string; caption: string | null; catalogue_id: number | null };
type TabKey = number | 'other';

export default function ProfessionalProfile() {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [professional, setProfessional] = useState<Professional | null>(null);
  const [catalogues, setCatalogues] = useState<Catalogue[]>([]);
  const [work, setWork] = useState<WorkPhoto[]>([]);
  const [selectedTab, setSelectedTab] = useState<TabKey | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingChat, setOpeningChat] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const [{ data, error: loadError }, { data: cats }, { data: photos }] = await Promise.all([
        supabase
          .from('professionals')
          .select('id, first_name, last_name, profession, location, avatar_path, services(id, name, category, offered_at, price, duration_minutes)')
          .eq('id', id)
          .single(),
        supabase
          .from('portfolio_catalogues')
          .select('id, name')
          .eq('professional_id', id)
          .order('created_at', { ascending: true }),
        supabase
          .from('portfolio_photos')
          .select('id, path, caption, catalogue_id')
          .eq('professional_id', id)
          .order('created_at', { ascending: false }),
      ]);

      if (loadError || !data) {
        setError(loadError?.message ?? "This profile isn't available any more.");
      } else {
        data.services.sort((a: Service, b: Service) => a.price - b.price);
        setProfessional(data as Professional);
        setCatalogues(cats ?? []);
        setWork(photos ?? []);
      }

      setLoading(false);
    }

    loadProfile();
  }, [id]);

  async function handleMessage() {
    if (!professional) return;

    setError(null);
    setOpeningChat(true);

    try {
      const conversationId = await getOrCreateConversation(professional.id);
      router.push({ pathname: '/chat/[conversationId]', params: { conversationId: String(conversationId) } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The chat didn't open. Check your connection and try again.");
    } finally {
      setOpeningChat(false);
    }
  }

  if (loading) {
    return (
      <View style={ui.centered}>
        <ActivityIndicator size="large" color={colors.accentDark} />
      </View>
    );
  }

  if (!professional) {
    return (
      <View style={[ui.screen, ui.content]}>
        <Text style={ui.error}>{error}</Text>
      </View>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    ...catalogues
      .filter((c) => work.some((p) => p.catalogue_id === c.id))
      .map((c) => ({ key: c.id as TabKey, label: c.name })),
    ...(work.some((p) => p.catalogue_id === null)
      ? [{ key: 'other' as TabKey, label: catalogues.length > 0 ? 'Other' : 'All' }]
      : []),
  ];

  const activeKey = tabs.some((t) => t.key === selectedTab) ? selectedTab : tabs[0]?.key ?? null;
  const shown = work.filter((p) => (activeKey === 'other' ? p.catalogue_id === null : p.catalogue_id === activeKey));
  const viewerPhotos = shown.map((p) => ({ id: p.id, url: professionalPhotoUrl(p.path) ?? '', caption: p.caption }));
  const firstName = professional.first_name;

  return (
    <View style={ui.screen}>
      <FlatList
        data={professional.services}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={ui.content}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Avatar name={firstName} url={professionalPhotoUrl(professional.avatar_path)} size={80} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {firstName} {professional.last_name}
                </Text>
                <Text style={styles.profession}>
                  {professionLabels[professional.profession] ?? professional.profession}
                  {professional.location ? ` in ${professional.location}` : ''}
                </Text>
              </View>
            </View>

            <Pressable
              style={[styles.messageButton, openingChat && ui.buttonDisabled]}
              onPress={handleMessage}
              disabled={openingChat}
            >
              {openingChat ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.text} />
                  <Text style={styles.messageText}>Message {firstName}</Text>
                </>
              )}
            </Pressable>

            {error && <Text style={ui.error}>{error}</Text>}

            {work.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>{firstName}'s work</Text>
                {tabs.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
                    {tabs.map((t) => (
                      <Pressable
                        key={String(t.key)}
                        style={[ui.chip, activeKey === t.key && ui.chipSelected]}
                        onPress={() => setSelectedTab(t.key)}
                      >
                        <Text style={[ui.chipText, activeKey === t.key && ui.chipTextSelected]}>{t.label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
                <View style={styles.grid}>
                  {shown.map((photo, i) => (
                    <Pressable key={photo.id} style={styles.tile} onPress={() => setViewerIndex(i)}>
                      <Image
                        source={{ uri: professionalPhotoUrl(photo.path) ?? undefined }}
                        style={styles.image}
                        contentFit="cover"
                        transition={150}
                      />
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.sectionTitle}>Book a service</Text>
            {professional.services.length === 0 && (
              <Text style={ui.muted}>{firstName} hasn't added any services yet.</Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.serviceName}>{item.name}</Text>
              <Text style={styles.price}>{formatPrice(item.price)}</Text>
            </View>
            <Text style={styles.serviceDetails}>{formatDuration(item.duration_minutes)}</Text>
            {item.offered_at !== 'at_professional' && (
              <View style={styles.homeTag}>
                <Ionicons name="home-outline" size={12} color={colors.text} />
                <Text style={styles.homeTagText}>{offeredAtLabels[item.offered_at]}</Text>
              </View>
            )}

            <Link href={{ pathname: '/customer/book/[serviceId]', params: { serviceId: String(item.id) } }} asChild>
              <Pressable style={styles.bookButton}>
                <Text style={styles.bookText}>Book</Text>
              </Pressable>
            </Link>
          </View>
        )}
      />

      <PhotoViewer photos={viewerPhotos} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  name: { fontFamily: fonts.extraBold, fontSize: 24, lineHeight: 28, letterSpacing: -0.3, color: colors.text },
  profession: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.textMuted, marginTop: 4 },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.accentDark,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: spacing.xl,
  },
  messageText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginTop: spacing.xxl, marginBottom: spacing.md },
  tabs: { gap: spacing.sm, paddingBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '31.5%', aspectRatio: 1, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.accentSoft },
  image: { width: '100%', height: '100%' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  serviceName: { flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  price: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
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
  bookButton: {
    backgroundColor: colors.accentDark,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  bookText: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.onAccent },
}));