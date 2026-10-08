import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, fonts, spacing } from '../lib/theme';
import { ui } from '../lib/ui';

type Role = 'customer' | 'professional';
type Profession = 'barber' | 'hairdresser' | 'makeup_artist' | 'nail_artist';

const professions: { value: Profession; label: string }[] = [
  { value: 'barber', label: 'Barber' },
  { value: 'hairdresser', label: 'Hairdresser' },
  { value: 'makeup_artist', label: 'Makeup artist' },
  { value: 'nail_artist', label: 'Nail artist' },
];

export default function SignUp() {
  const [role, setRole] = useState<Role>('customer');
  const [profession, setProfession] = useState<Profession | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUp() {
    setError(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError('Please fill in all the fields.');
      return;
    }
    if (role === 'professional' && !profession) {
      setError('Please choose what you do.');
      return;
    }
    if (password.length < 6) {
      setError('Your password needs at least 6 characters.');
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'Something went wrong. Please try again.');
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

        <Text style={ui.label}>I am a</Text>
        <View style={styles.row}>
          {(['customer', 'professional'] as Role[]).map((r) => (
            <Pressable
              key={r}
              style={[styles.roleCard, role === r && styles.roleCardSelected]}
              onPress={() => setRole(r)}
            >
              <Text style={[styles.roleTitle, role === r && styles.roleTitleSelected]}>
                {r === 'customer' ? 'Customer' : 'Professional'}
              </Text>
              <Text style={[styles.roleHint, role === r && styles.roleHintSelected]}>
                {r === 'customer' ? 'I want to book' : 'I offer services'}
              </Text>
            </Pressable>
          ))}
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
          </>
        )}

        <Text style={ui.label}>First name</Text>
        <TextInput style={ui.input} value={firstName} onChangeText={setFirstName} />

        <Text style={ui.label}>Last name</Text>
        <TextInput style={ui.input} value={lastName} onChangeText={setLastName} />

        <Text style={ui.label}>Email</Text>
        <TextInput
          style={ui.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={ui.label}>Password</Text>
        <TextInput style={ui.input} value={password} onChangeText={setPassword} secureTextEntry />
        <Text style={ui.help}>At least 6 characters.</Text>

        {error && <Text style={ui.error}>{error}</Text>}

        <Pressable style={[ui.button, loading && ui.buttonDisabled]} onPress={handleSignUp} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={ui.buttonText}>Create account</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  roleCard: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.lg },
  roleCardSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accentDark },
  roleTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  roleTitleSelected: { color: colors.accentDark },
  roleHint: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 4 },
  roleHintSelected: { color: colors.accentDark },
});