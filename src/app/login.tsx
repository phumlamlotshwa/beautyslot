import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { getRole } from '../lib/get-role';
import { supabase } from '../lib/supabase';
import { fonts, spacing } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';
import { useUi } from '../lib/ui';

export default function LogIn() {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogIn() {
    setError(null);

    if (!email.trim()) {
      setError('Add your email address.');
      return;
    }
    if (!password) {
      setError('Add your password.');
      return;
    }

    setLoading(true);

    const { data, error: logInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (logInError || !data.user) {
      const message = logInError?.message.toLowerCase() ?? '';
      if (message.includes('invalid login credentials')) {
        setError("That email and password don't match. Check them and try again.");
      } else if (message.includes('not confirmed')) {
        setLoading(false);
        router.push({ pathname: '/verify-email', params: { email: email.trim(), resend: '1' } });
        return;
      } else {
        setError(logInError?.message ?? "You weren't logged in. Check your connection and try again.");
      }
      setLoading(false);
      return;
    }

    const role = await getRole(data.user.id);

    setLoading(false);

    if (!role) {
      await supabase.auth.signOut();
      setError("This account isn't set up yet. Create an account to finish setting it up.");
      return;
    }

    router.replace(role === 'customer' ? '/customer' : '/professional');
  }

  return (
    <KeyboardAvoidingView
      style={ui.screen}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <Text style={ui.title}>Welcome back</Text>

        <Text style={[ui.label, { marginTop: 0 }]}>Email</Text>
        <TextInput
          style={ui.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        <Text style={ui.label}>Password</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={[ui.input, styles.passwordInput]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleLogIn}
          />
          <Pressable style={styles.showButton} onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
            <Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </Pressable>
        </View>

        {error && <Text style={ui.error}>{error}</Text>}

        <Pressable style={[ui.button, loading && ui.buttonDisabled]} onPress={handleLogIn} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={ui.buttonText}>Log in</Text>}
        </Pressable>

        <View style={styles.footer}>
          <Text style={ui.muted}>New to BeautySlot?</Text>
          <Link href="/sign-up" replace asChild>
            <Pressable hitSlop={8}>
              <Text style={styles.footerLink}>Create an account</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  passwordRow: { justifyContent: 'center' },
  passwordInput: { paddingRight: 64 },
  showButton: { position: 'absolute', right: spacing.md },
  showText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: spacing.xl },
  footerLink: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, textDecorationLine: 'underline' },
}));