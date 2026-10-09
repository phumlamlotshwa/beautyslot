import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { fonts, radius, spacing } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';
import { useUi } from '../lib/ui';

type Role = 'customer' | 'professional';
type Profession = 'barber' | 'hairdresser' | 'makeup_artist' | 'nail_artist';

const roles: { value: Role; title: string; hint: string }[] = [
  { value: 'customer', title: "I'm booking", hint: 'I want my hair, nails or makeup done' },
  { value: 'professional', title: "I'm a professional", hint: 'I want customers to book me' },
];

const professions: { value: Profession; label: string }[] = [
  { value: 'barber', label: 'Barber' },
  { value: 'hairdresser', label: 'Hairdresser' },
  { value: 'makeup_artist', label: 'Makeup artist' },
  { value: 'nail_artist', label: 'Nail artist' },
];

export default function SignUp() {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();

  const [role, setRole] = useState<Role>('customer');
  const [profession, setProfession] = useState<Profession | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Says exactly what's missing, one thing at a time, top to bottom
  function findProblem() {
    if (role === 'professional' && !profession) return 'Choose what you do.';
    if (!firstName.trim()) return 'Add your first name.';
    if (!lastName.trim()) return 'Add your last name.';
    if (!email.trim()) return 'Add your email address.';
    if (password.length < 6) return 'Your password needs at least 6 characters.';
    return null;
  }

  async function handleSignUp() {
    const problem = findProblem();
    setError(problem);
    if (problem) return;

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError || !data.user) {
      if (signUpError?.message.toLowerCase().includes('already registered')) {
        setError('There is already an account with this email. Log in instead.');
      } else if (signUpError?.message.toLowerCase().includes('email')) {
        setError("That email address doesn't look right. Check it and try again.");
      } else {
        setError(signUpError?.message ?? "Your account wasn't created. Check your connection and try again.");
      }
      setLoading(false);
      return;
    }

    const profile = {
      id: data.user.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    };

    const { error: profileError } =
      role === 'customer'
        ? await supabase.from('customers').insert(profile)
        : await supabase.from('professionals').insert({ ...profile, profession });

    setLoading(false);

    if (profileError) {
      setError(profileError.message);
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
        <Text style={ui.title}>Create your account</Text>

        <Text style={[ui.label, { marginTop: 0 }]}>How will you use BeautySlot?</Text>
        <View style={styles.row}>
          {roles.map((r) => {
            const selected = role === r.value;
            return (
              <Pressable
                key={r.value}
                style={[styles.roleCard, selected && styles.roleCardSelected]}
                onPress={() => setRole(r.value)}
              >
                <Text style={[styles.roleTitle, selected && styles.roleTextSelected]}>{r.title}</Text>
                <Text style={[styles.roleHint, selected && styles.roleHintSelected]}>{r.hint}</Text>
              </Pressable>
            );
          })}
        </View>

        {role === 'professional' && (
          <>
            <Text style={ui.label}>What do you do?</Text>
            <View style={styles.wrap}>
              {professions.map((p) => (
                <Pressable
                  key={p.value}
                  style={[ui.chip, profession === p.value && ui.chipSelected]}
                  onPress={() => setProfession(p.value)}
                >
                  <Text style={[ui.chipText, profession === p.value && ui.chipTextSelected]}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={ui.help}>Run a salon? Pick what you do most. You can add your team later.</Text>
          </>
        )}

        <Text style={ui.label}>First name</Text>
        <TextInput
          style={ui.input}
          value={firstName}
          onChangeText={setFirstName}
          autoComplete="given-name"
          textContentType="givenName"
        />

        <Text style={ui.label}>Last name</Text>
        <TextInput
          style={ui.input}
          value={lastName}
          onChangeText={setLastName}
          autoComplete="family-name"
          textContentType="familyName"
        />

        <Text style={ui.label}>Email</Text>
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
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <Pressable style={styles.showButton} onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
            <Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </Pressable>
        </View>
        <Text style={ui.help}>At least 6 characters.</Text>

        {error && <Text style={ui.error}>{error}</Text>}

        <Pressable style={[ui.button, loading && ui.buttonDisabled]} onPress={handleSignUp} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={ui.buttonText}>Create account</Text>}
        </Pressable>

        <View style={styles.footer}>
          <Text style={ui.muted}>Already have an account?</Text>
          <Link href="/login" replace asChild>
            <Pressable hitSlop={8}>
              <Text style={styles.footerLink}>Log in</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  roleCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  roleCardSelected: { backgroundColor: colors.accentDark, borderColor: colors.accentDark },
  roleTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  roleTextSelected: { color: colors.onAccent },
  roleHint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted, marginTop: 4 },
  roleHintSelected: { color: colors.onAccent, opacity: 0.75 },
  passwordRow: { justifyContent: 'center' },
  passwordInput: { paddingRight: 64 },
  showButton: { position: 'absolute', right: spacing.md },
  showText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: spacing.xl },
  footerLink: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, textDecorationLine: 'underline' },
}));