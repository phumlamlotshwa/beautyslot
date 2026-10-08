import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getRole } from '../lib/get-role';
import { supabase } from '../lib/supabase';

export default function Welcome() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (user) {
        const role = await getRole(user.id);
        if (role) {
          router.replace(role === 'customer' ? '/customer' : '/professional');
          return;
        }
        await supabase.auth.signOut();
      }

      setChecking(false);
    }

    checkSession();
  }, []);

  if (checking) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>BeautySlot</Text>
      <Text style={styles.text}>Book beauty professionals near you.</Text>

      <Link href="/sign-up" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Create an account</Text>
        </Pressable>
      </Link>

      <Link href="/login" asChild>
        <Pressable style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>I already have an account</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff', padding: 24, justifyContent: 'center' },
  title: { fontSize: 34, fontWeight: '700', color: '#000000' },
  text: { fontSize: 16, color: '#333333', marginTop: 8, marginBottom: 40 },
  button: { backgroundColor: '#000000', borderRadius: 8, padding: 16, alignItems: 'center' },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  secondaryButton: { borderWidth: 1, borderColor: '#000000', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 12 },
  secondaryButtonText: { color: '#000000', fontSize: 16, fontWeight: '600' },
});