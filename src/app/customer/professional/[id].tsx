import { Ionicons } from '@expo/vector-icons';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getOrCreateConversation } from '../../../lib/chat';
import { formatDuration, formatPrice, OfferedAt, offeredAtLabels, professionLabels } from '../../../lib/format';
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
  services: Service[];
};

export default function ProfessionalProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingChat, setOpeningChat] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data, error: loadError } = await supabase
        .from('professionals')
        .select('id, first_name, last_name, profession, location, services(id, name, category, offered_at, price, duration_minutes)')
        .eq('id', id)
        .single();

      if (loadError || !data) {
        setError(loadError?.message ?? 'Professional not found.');
      } else {
        data.services.sort((a: Service, b: Service) => a.price - b.price);
        setProfessional(data as Professional);
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

  return (
    <View style={ui.screen}>
      <FlatList
        data={professional.services}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={ui.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{professional.first_name.charAt(0)}</Text>
            </View>
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

            <Text style={styles.sectionTitle}>Services</Text>
          </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: spacing.sm },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, fontSize: 36, color: colors.accentDark },
  name: { fontFamily: fonts.bold, fontSize: 24, color: colors.text, marginTop: spacing.md },
  profession: { fontFamily: fonts.medium, fontSize: 15, color: colors.accentDark, marginTop: 2 },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  area: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accentDark,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    minWidth: 150,
  },
  messageText: { fontFamily: fonts.medium, fontSize: 15, color: colors.accentDark },
  sectionTitle: { alignSelf: 'flex-start', fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginTop: spacing.xxl, marginBottom: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  serviceName: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  serviceDetails: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: 2 },
  homeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 8, marginTop: spacing.sm },
  homeTagText: { fontFamily: fonts.medium, fontSize: 12, color: colors.accentDark },
  priceColumn: { alignItems: 'flex-end', marginLeft: spacing.md },
  price: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  bookText: { fontFamily: fonts.medium, fontSize: 13, color: colors.accentDark, marginTop: 4 },
});