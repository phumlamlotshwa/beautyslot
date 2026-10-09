import { Image } from 'expo-image';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, Text, View } from 'react-native';
import { getRole } from '../lib/get-role';
import { supabase } from '../lib/supabase';
import { fonts, radius, spacing } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';

export default function Welcome() {
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const [checking, setChecking] = useState(true);

  // This screen is always black, so the clock and battery are white here.
  // When you leave, they go back to matching the rest of the app.
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      return () => StatusBar.setBarStyle(scheme === 'dark' ? 'light-content' : 'dark-content');
    }, [scheme])
  );

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
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.onHeader} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View>
        <View style={styles.brandRow}>
          <Image style={styles.logo} source={require('@/assets/images/splash-icon.png')} />
          <Text style={styles.brand}>BeautySlot</Text>
        </View>

        <Text style={styles.headline}>Hair, nails and makeup, booked in a few taps.</Text>
        <Text style={styles.intro}>
          Find stylists, barbers and makeup artists near you. Go to them, or have them come to you.
        </Text>
      </View>

      <View>
        <Text style={styles.proNote}>Do hair, nails or makeup? Sign up to take bookings too.</Text>

        <Link href="/sign-up" asChild>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryText}>Create an account</Text>
          </Pressable>
        </Link>

        <Link href="/login" asChild>
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Log in</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  loading: { flex: 1, backgroundColor: colors.header, alignItems: 'center', justifyContent: 'center' },
  screen: {
    flex: 1,
    backgroundColor: colors.header,
    paddingHorizontal: spacing.xl,
    paddingTop: 96,
    paddingBottom: 48,
    justifyContent: 'space-between',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: { width: 40, height: 40 },
  brand: { fontFamily: fonts.bold, fontSize: 20, color: colors.onHeader },
  headline: {
    fontFamily: fonts.extraBold,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.8,
    color: colors.onHeader,
    marginTop: 56,
  },
  intro: {
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 25,
    color: colors.onHeaderMuted,
    marginTop: spacing.lg,
    maxWidth: 320,
  },
  proNote: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.onHeaderMuted, marginBottom: spacing.lg },
  primaryButton: { backgroundColor: colors.onHeader, borderRadius: radius.sm + 2, padding: spacing.lg, alignItems: 'center' },
  primaryText: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.header },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: colors.onHeader,
    borderRadius: radius.sm + 2,
    padding: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  secondaryText: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.onHeader },
}));