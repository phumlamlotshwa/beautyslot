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

export default function VerifyEmail() {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();
  const { email, resend } = useLocalSearchParams<{ email: string; resend?: string }>();

  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wait, setWait] = useState(resend ? 0 : WAIT_SECONDS);

  useEffect(() => {
    if (resend) sendCode();
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function sendCode() {
    setError(null);
    setNotice(null);

    const { error: sendError } = await supabase.auth.resend({ type: 'signup', email });

    if (sendError) {
      setError("Couldn't send a new code. Wait a minute and try again.");
      return;
    }

    setNotice('A new code is on its way.');
    setWait(WAIT_SECONDS);
  }

  async function handleConfirm() {
    const token = code.trim();

    if (token.length < 6) {
      setError('Type in the code from the email.');
      return;
    }

    setError(null);
    setChecking(true);

    const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: 'email' });

    if (verifyError || !data.user) {
      setChecking(false);
      setError("That code didn't work. Check it, or send a new one.");
      return;
    }

    const role = await getRole(data.user.id);
    setChecking(false);

    if (!role) {
      setError('Your email is confirmed. Log in to carry on.');
      return;
    }

    router.replace(role === 'customer' ? '/customer' : '/professional');
  }

  return (
    <KeyboardAvoidingView style={ui.screen} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <Stack.Screen options={{ title: 'Confirm your email' }} />
      <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <Text style={ui.title}>Check your email</Text>
        <Text style={styles.lead}>
          We sent a code to <Text style={styles.email}>{email}</Text>
        </Text>

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
          returnKeyType="done"
          onSubmitEditing={handleConfirm}
        />

        {error && <Text style={ui.error}>{error}</Text>}
        {notice && !error && <Text style={styles.notice}>{notice}</Text>}

        <Pressable style={[ui.button, checking && ui.buttonDisabled]} onPress={handleConfirm} disabled={checking}>
          {checking ? <ActivityIndicator color={colors.onAccent} /> : <Text style={ui.buttonText}>Confirm</Text>}
        </Pressable>

        <View style={styles.footer}>
          <Text style={ui.muted}>No email? Check your spam folder.</Text>
          <Pressable onPress={sendCode} disabled={wait > 0} hitSlop={8}>
            <Text style={[styles.resend, wait > 0 && styles.resendWaiting]}>
              {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
            </Text>
          </Pressable>
        </View>
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
  notice: { fontFamily: fonts.medium, fontSize: 14, color: colors.text, marginTop: spacing.sm },
  footer: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  resend: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, textDecorationLine: 'underline' },
  resendWaiting: { color: colors.textFaint, textDecorationLine: 'none' },
}));