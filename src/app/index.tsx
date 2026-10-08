import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getRole } from '../lib/get-role';
import { supabase } from '../lib/supabase';
import { colors, fonts, spacing } from '../lib/theme';
import { ui } from '../lib/ui';

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
      <View style={ui.centered}>
        <ActivityIndicator size="large" color={colors.accentDark} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.brand}>BeautySlot</Text>
        <Text style={styles.tagline}>Book beauty professionals near you, at their place or yours.</Text>
      </View>

      <View>
        <Link href="/sign-up" asChild>
          <Pressable style={ui.button}>
            <Text style={ui.buttonText}>Create an account</Text>
          </Pressable>
        </Link>

        <Link href="/login" asChild>
          <Pressable style={styles.loginButton}>
            <Text style={ui.outlineButtonText}>I already have an account</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, paddingTop: 120, paddingBottom: 48, justifyContent: 'space-between' },
  hero: { alignItems: 'flex-start' },
  brand: { fontFamily: fonts.bold, fontSize: 40, color: colors.accentDark },
  tagline: { fontFamily: fonts.regular, fontSize: 18, lineHeight: 26, color: colors.textMuted, marginTop: spacing.md, maxWidth: 300 },
  loginButton: { borderWidth: 1, borderColor: colors.accentDark, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.md },
});