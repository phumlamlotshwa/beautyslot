import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput } from 'react-native';
import { getRole } from '../lib/get-role';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { ui } from '../lib/ui';

export default function LogIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogIn() {
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);

    const { data, error: logInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (logInError || !data.user) {
      setError(logInError?.message ?? 'Something went wrong. Please try again.');
      setLoading(false);
      return;
    }

    const role = await getRole(data.user.id);

    setLoading(false);

    if (!role) {
      await supabase.auth.signOut();
      setError("We couldn't find your profile. Please sign up again or contact support.");
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

        {error && <Text style={ui.error}>{error}</Text>}

        <Pressable style={[ui.button, loading && ui.buttonDisabled]} onPress={handleLogIn} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={ui.buttonText}>Log in</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}