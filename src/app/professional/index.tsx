import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MessagesButton } from '../../components/messages-button';
import { formatDuration, formatPrice } from '../../lib/format';
import { supabase } from '../../lib/supabase';

type Service = {
  id: number;
  name: string;
  category: string;
  price: number;
  duration_minutes: number;
};

export default function ProfessionalHome() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      async function loadServices() {
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const { data, error: loadError } = await supabase
          .from('services')
          .select('id, name, category, price, duration_minutes')
          .eq('professional_id', user.id)
          .order('created_at', { ascending: true });

        if (loadError) {
          setError(loadError.message);
        } else {
          setServices(data ?? []);
        }

        setLoading(false);
      }

      loadServices();
    }, [])
  );

  async function handleLogOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={services}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>My services</Text>
              <Link href="/professional/bookings" asChild>
              <Pressable style={styles.outlineButton}>
                <Text style={styles.secondaryButtonText}>Bookings</Text>
              </Pressable>
            </Link>
            <MessagesButton />
            <Link href="/professional/hours" asChild>
              <Pressable style={styles.outlineButton}>
                <Text style={styles.secondaryButtonText}>Set working hours</Text>
              </Pressable>
            </Link>
                        <Link href="/professional/home-visits" asChild>
              <Pressable style={styles.outlineButton}>
                <Text style={styles.secondaryButtonText}>Home visits</Text>
              </Pressable>
            </Link>
            <Link href="/professional/add-service" asChild>
              <Pressable style={styles.button}>
                <Text style={styles.buttonText}>Add a service</Text>
              </Pressable>
            </Link>
            {error && <Text style={styles.error}>{error}</Text>}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 32 }} color="#000000" />
          ) : (
            <Text style={styles.empty}>You haven't added any services yet.</Text>
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
              </View>
              <Text style={styles.price}>{formatPrice(item.price)}</Text>
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
  outlineButton: { borderWidth: 1, borderColor: '#000000', borderRadius: 8, padding: 16, alignItems: 'center', marginBottom: 12 },
  button: { backgroundColor: '#000000', borderRadius: 8, padding: 16, alignItems: 'center', marginBottom: 24 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  error: { color: '#c62828', marginBottom: 16 },
  empty: { fontSize: 16, color: '#666666', textAlign: 'center', marginTop: 32 },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#eeeeee', borderRadius: 12, padding: 16, marginBottom: 12 },
  serviceName: { fontSize: 16, fontWeight: '600', color: '#000000' },
  serviceDetails: { fontSize: 14, color: '#666666', marginTop: 4 },
  price: { fontSize: 16, fontWeight: '600', color: '#000000', marginLeft: 12 },
  secondaryButton: { borderWidth: 1, borderColor: '#000000', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 24 },
  secondaryButtonText: { color: '#000000', fontSize: 16, fontWeight: '600' },
});