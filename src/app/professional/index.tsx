import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function ProfessionalHome() {
  async function handleLogOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Professional home</Text>
      <Text style={styles.text}>This is where you'll manage your services and bookings.</Text>
      <Pressable style={styles.button} onPress={handleLogOut}>
        <Text style={styles.buttonText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff', padding: 24, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: '#000000' },
  text: { fontSize: 16, color: '#333333', marginTop: 8 },
  button: { backgroundColor: '#000000', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 32 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});