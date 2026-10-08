import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';

type Professional = {
  id: string;
  first_name: string;
  last_name: string;
  profession: string;
  location: string | null;
};

const professionLabels: Record<string, string> = {
  barber: 'Barber',
  hairdresser: 'Hairdresser',
  makeup_artist: 'Makeup artist',
  nail_artist: 'Nail artist',
};

export default function CustomerHome() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      async function loadProfessionals() {
        setError(null);

        const { data, error: loadError } = await supabase
          .from('professionals')
          .select('id, first_name, last_name, profession, location, services!inner(id)')
          .order('first_name', { ascending: true });

        if (loadError) {
          setError(loadError.message);
        } else {
          setProfessionals(data ?? []);
        }

        setLoading(false);
      }

      loadProfessionals();
    }, [])
  );

  async function handleLogOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={professionals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Find a professional</Text>
            {error && <Text style={styles.error}>{error}</Text>}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 32 }} color="#000000" />
          ) : (
            <Text style={styles.empty}>No professionals yet. Check back soon.</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
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
            </View>
          </View>
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
  error: { color: '#c62828', marginBottom: 16 },
  empty: { fontSize: 16, color: '#666666', textAlign: 'center', marginTop: 32 },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#eeeeee', borderRadius: 12, padding: 16, marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '600', color: '#000000' },
  details: { fontSize: 14, color: '#666666', marginTop: 4 },
  secondaryButton: { borderWidth: 1, borderColor: '#000000', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 24 },
  secondaryButtonText: { color: '#000000', fontSize: 16, fontWeight: '600' },
});