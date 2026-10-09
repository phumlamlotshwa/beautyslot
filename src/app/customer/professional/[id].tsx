import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../../components/avatar';
import { PhotoViewer } from '../../../components/photo-viewer';
import { getOrCreateConversation } from '../../../lib/chat';
import { formatDuration, formatPrice, OfferedAt, offeredAtLabels, professionLabels } from '../../../lib/format';
import { professionalPhotoUrl } from '../../../lib/photos';
import { supabase } from '../../../lib/supabase';
import { colors, fonts, radius, spacing } from '../../../lib/theme';
import { ui } from '../../../lib/ui';

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
        setError(loadError?.message ?? 'Professional not found.');
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
      setError(e instanceof Error ? e.message : 'Could not open the chat. Please try again.');
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

  return (
    <View style={ui.screen}>
      <FlatList
        data={professional.services}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={ui.content}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Avatar
                name={professional.first_name}
                url={professionalPhotoUrl(professional.avatar_path)}
                size={96}
              />
              <Text style={styles.name}>
                {professional.first_name} {professional.last_name}
              </Text>
              <Text style={styles.profession}>
                {professionLabels[professional.profession] ?? professional.profession}
              </Text>
              {professional.location && (
                <View style={styles.areaRow}>
                  <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.area}>{professional.location}</Text>
                </View>
              )}

              <Pressable
                style={[styles.messageButton, openingChat && ui.buttonDisabled]}
                onPress={handleMessage}
                disabled={openingChat}
              >
                {openingChat ? (
                  <ActivityIndicator color={colors.accentDark} />
                ) : (
                  <>
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.accentDark} />
                    <Text style={styles.messageText}>Message</Text>
                  </>
                )}
              </Pressable>

              {error && <Text style={ui.error}>{error}</Text>}
            </View>

            {work.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Their work</Text>
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

            <Text style={styles.sectionTitle}>Services</Text>
          </>
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/customer/book/[serviceId]', params: { serviceId: String(item.id) } }} asChild>
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
              <View style={styles.priceColumn}>
                <Text style={styles.price}>{formatPrice(item.price)}</Text>
                <Text style={styles.bookText}>Book ›</Text>
              </View>
            </Pressable>
          </Link>
        )}
      />

      <PhotoViewer photos={viewerPhotos} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: spacing.sm },
  name: { fontFamily: fonts.bold, fontSize: 24, color: colors.text, marginTop: spacing.md },
  profession: { fontFamily: fonts.medium, fontSize: 15, color: colors.accentDark, marginTop: 2 },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  area: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  messageButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accentDark, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: spacing.xl, marginTop: spacing.lg, minWidth: 150 },
  messageText: { fontFamily: fonts.medium, fontSize: 15, color: colors.accentDark },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginTop: spacing.xxl, marginBottom: spacing.md },
  tabs: { gap: spacing.sm, paddingBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '31.5%', aspectRatio: 1, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.accentSoft },
  image: { width: '100%', height: '100%' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  serviceName: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  serviceDetails: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: 2 },
  homeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 8, marginTop: spacing.sm },
  homeTagText: { fontFamily: fonts.medium, fontSize: 12, color: colors.accentDark },
  priceColumn: { alignItems: 'flex-end', marginLeft: spacing.md },
  price: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  bookText: { fontFamily: fonts.medium, fontSize: 13, color: colors.accentDark, marginTop: 4 },
});