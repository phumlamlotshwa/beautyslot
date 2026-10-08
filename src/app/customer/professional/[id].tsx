import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getOrCreateConversation } from '../../../lib/chat';
import { formatDuration, formatPrice, professionLabels } from '../../../lib/format';
import { supabase } from '../../../lib/supabase';

type Service = {
  id: number;
  name: string;
  category: string;
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
        .select('id, first_name, last_name, profession, location, services(id, name, category, price, duration_minutes)')
        .eq('id', id)
        .single();

      if (loadError || !data) {
        setError(loadError?.message ?? 'Professional not found.');
      } else {
        data.services.sort((a: Service, b: Service) => a.price - b.price);
        setProfessional(data);
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
      <View style={[styles.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  if (!professional) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={professional.services}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{professional.first_name.charAt(0)}</Text>
            </View>
            <Text style={styles.name}>
              {professional.first_name} {professional.last_name}
            </Text>
            <Text style={styles.details}>
              {professionLabels[professional.profession] ?? professional.profession}
              {professional.location ? ` · ${professional.location}` : ''}
            </Text>

            <Pressable
              style={[styles.messageButton, openingChat && styles.buttonDisabled]}
              onPress={handleMessage}
              disabled={openingChat}
            >
              {openingChat ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.messageButtonText}>Message</Text>
              )}
            </Pressable>

            {error && <Text style={styles.error}>{error}</Text>}

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
              </View>
              <Text style={styles.price}>{formatPrice(item.price)}</Text>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 24, paddingBottom: 48 },
  error: { color: '#c62828', fontSize: 15, marginTop: 12 },
  header: { alignItems: 'center', marginBottom: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontSize: 32, fontWeight: '700' },
  name: { fontSize: 24, fontWeight: '700', color: '#000000', marginTop: 12 },
  details: { fontSize: 15, color: '#666666', marginTop: 4 },
  messageButton: { borderWidth: 1, borderColor: '#000000', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 32, marginTop: 16, minWidth: 140, alignItems: 'center' },
  messageButtonText: { color: '#000000', fontSize: 15, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  sectionTitle: { alignSelf: 'flex-start', fontSize: 18, fontWeight: '700', color: '#000000', marginTop: 32, marginBottom: 12 },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#eeeeee', borderRadius: 12, padding: 16, marginBottom: 12 },
  serviceName: { fontSize: 16, fontWeight: '600', color: '#000000' },
  serviceDetails: { fontSize: 14, color: '#666666', marginTop: 4 },
  price: { fontSize: 15, fontWeight: '600', color: '#000000', marginLeft: 12 },
});