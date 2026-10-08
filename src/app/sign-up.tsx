import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';

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

    Alert.alert('Welcome to BeautySlot', 'Your account has been created.');
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create your account</Text>

        <Text style={styles.label}>I am a</Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.choice, role === 'customer' && styles.choiceSelected]}
            onPress={() => setRole('customer')}
          >
            <Text style={[styles.choiceText, role === 'customer' && styles.choiceTextSelected]}>Customer</Text>
          </Pressable>
          <Pressable
            style={[styles.choice, role === 'professional' && styles.choiceSelected]}
            onPress={() => setRole('professional')}
          >
            <Text style={[styles.choiceText, role === 'professional' && styles.choiceTextSelected]}>Professional</Text>
          </Pressable>
        </View>

        {role === 'professional' && (
          <>
            <Text style={styles.label}>What do you do?</Text>
            <View style={styles.wrap}>
              {professions.map((p) => (
                <Pressable
                  key={p.value}
                  style={[styles.choice, profession === p.value && styles.choiceSelected]}
                  onPress={() => setProfession(p.value)}
                >
                  <Text style={[styles.choiceText, profession === p.value && styles.choiceTextSelected]}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={styles.label}>First name</Text>
        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />

        <Text style={styles.label}>Last name</Text>
        <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSignUp} disabled={loading}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Create account</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: '700', color: '#000000', marginBottom: 16 },
  label: { fontSize: 14, color: '#333333', marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#cccccc', borderRadius: 8, padding: 12, fontSize: 16, color: '#000000' },
  row: { flexDirection: 'row', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderWidth: 1, borderColor: '#cccccc', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16 },
  choiceSelected: { backgroundColor: '#000000', borderColor: '#000000' },
  choiceText: { color: '#000000' },
  choiceTextSelected: { color: '#ffffff' },
  error: { color: '#c62828', marginTop: 16 },
  button: { backgroundColor: '#000000', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 24 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});