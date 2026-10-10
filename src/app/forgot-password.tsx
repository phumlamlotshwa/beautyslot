import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getRole } from '../lib/get-role';
import { supabase } from '../lib/supabase';
import { fonts, radius, spacing } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';
import { useUi } from '../lib/ui';

const WAIT_SECONDS = 60;

export default function ForgotPassword() {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? '');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function sendCode() {
    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError('Add your email address.');
      return;
    }

    setLoading(true);

    if (!codeSent) {
      const { data: hasAccount, error: checkError } = await supabase.rpc('email_has_account', {
        p_email: email.trim(),
      });

      if (checkError) {
        setLoading(false);
        setError("Couldn't check that email. Check your connection and try again.");
        return;
      }
      if (!hasAccount) {
        setLoading(false);
        setError("There's no BeautySlot account with this email. Check it, or create an account.");
        return;
      }
    }

    const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);

    if (sendError) {
      setError("Couldn't send a code. Wait a minute and try again.");
      return;
    }

    if (codeSent) setNotice('A new code is on its way.');
    setCodeSent(true);
    setWait(WAIT_SECONDS);
  }

  async function handleSave() {
    setError(null);
    setNotice(null);

    const token = code.trim();

    if (!verified && token.length < 6) {
      setError('Type in the code from the email.');
      return;
    }
    if (password.length < 6) {
      setError('Your new password needs at least 6 characters.');
      return;
    }

    setLoading(true);

    if (!verified) {
      const { error: verifyError } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'recovery' });

      if (verifyError) {
        setLoading(false);
        setError("That code didn't work. Check it, or send a new one.");
        return;
      }

      setVerified(true);
    }

    const { data, error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError || !data.user) {
      setLoading(false);
      if (updateError?.message.toLowerCase().includes('different')) {
        setError("That's your current password. Pick a new one.");
      } else {
        setError("Your password wasn't changed. Check your connection and try again.");
      }
      return;
    }

    const role = await getRole(data.user.id);
    setLoading(false);

    if (!role) {
      await supabase.auth.signOut();
      setError('Your password is changed. Log in to carry on.');
      return;
    }

    router.replace(role === 'customer' ? '/customer' : '/professional');
  }

  return (
    <KeyboardAvoidingView style={ui.screen} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <Stack.Screen options={{ title: 'Forgot password' }} />
      <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        {!codeSent ? (
          <>
            <Text style={ui.title}>Reset your password</Text>
            <Text style={styles.lead}>We'll email you a code.</Text>

            <Text style={ui.label}>Email</Text>
            <TextInput
              style={ui.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={sendCode}
            />

            {error && <Text style={ui.error}>{error}</Text>}

            <Pressable style={[ui.button, loading && ui.buttonDisabled]} onPress={sendCode} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={ui.buttonText}>Send code</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={ui.title}>Check your email</Text>
            <Text style={styles.lead}>
              We sent a code to <Text style={styles.email}>{email.trim()}</Text>
            </Text>

            {!verified && (
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={8}
                autoFocus
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                placeholder="000000"
                placeholderTextColor={colors.textFaint}
              />
            )}

            <Text style={ui.label}>New password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[ui.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
              <Pressable style={styles.showButton} onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
                <Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>

            {error && <Text style={ui.error}>{error}</Text>}
            {notice && !error && <Text style={styles.notice}>{notice}</Text>}

            <Pressable style={[ui.button, loading && ui.buttonDisabled]} onPress={handleSave} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={ui.buttonText}>Save password</Text>
              )}
            </Pressable>

            {!verified && (
              <View style={styles.footer}>
                <Text style={ui.muted}>No email? Check your spam folder.</Text>
                <Pressable onPress={sendCode} disabled={wait > 0 || loading} hitSlop={8}>
                  <Text style={[styles.resend, wait > 0 && styles.resendWaiting]}>
                    {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  lead: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.textMuted, marginTop: spacing.sm },
  email: { fontFamily: fonts.semiBold, color: colors.text },
  codeInput: {
    fontFamily: fonts.bold,
    fontSize: 28,
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
  },
  passwordRow: { justifyContent: 'center' },
  passwordInput: { paddingRight: 64 },
  showButton: { position: 'absolute', right: spacing.md },
  showText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  notice: { fontFamily: fonts.medium, fontSize: 14, color: colors.text, marginTop: spacing.sm },
  footer: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  resend: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, textDecorationLine: 'underline' },
  resendWaiting: { color: colors.textFaint, textDecorationLine: 'none' },
}));