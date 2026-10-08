import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AddressInput } from '../../components/address-input';
import { Place } from '../../lib/maps';
import { supabase } from '../../lib/supabase';

export default function HomeVisits() {
  const [base, setBase] = useState<Place | null>(null);
  const [fee, setFee] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const [{ data: privateData }, { data: professional }] = await Promise.all([
        supabase
          .from('professional_private')
          .select('base_address, base_lat, base_lng')
          .eq('professional_id', user.id)
          .maybeSingle(),
        supabase
          .from('professionals')
          .select('call_out_fee')
          .eq('id', user.id)
          .single(),
      ]);

      if (privateData) {
        setBase({ address: privateData.base_address, lat: privateData.base_lat, lng: privateData.base_lng });
      }
      if (professional) {
        setFee(String(professional.call_out_fee));
      }

      setLoading(false);
    }

    loadSettings();
  }, []);

  async function handleSave() {
    setError(null);

    const feeNumber = Number(fee.replace(',', '.'));

    if (!base) {
      setError('Please search for your address and choose it from the list.');
      return;
    }
    if (fee === '' || isNaN(feeNumber) || feeNumber < 0) {
      setError('Please enter a valid call-out fee. Use 0 if you don\u2019t charge one.');
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('You need to be logged in to save.');
      setSaving(false);
      return;
    }

    const { error: privateError } = await supabase.from('professional_private').upsert({
      professional_id: user.id,
      base_address: base.address,
      base_lat: base.lat,
      base_lng: base.lng,
      updated_at: new Date().toISOString(),
    });

    if (privateError) {
      setError(privateError.message);
      setSaving(false);
      return;
    }

    const { error: feeError } = await supabase
      .from('professionals')
      .update({ call_out_fee: feeNumber })
      .eq('id', user.id);

    setSaving(false);

    if (feeError) {
      setError(feeError.message);
      return;
    }

    router.back();
  }

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Where do you travel from?</Text>
        <Text style={styles.help}>
          We use this to work out how far away customers are. It's private: customers never see it.
        </Text>
        <AddressInput value={base} onChange={setBase} />

        <Text style={styles.label}>Call-out fee (R)</Text>
        <Text style={styles.help}>Added to every home booking. Enter 0 if you don't charge one.</Text>
        <TextInput
          style={styles.input}
          value={fee}
          onChangeText={setFee}
          keyboardType="decimal-pad"
          placeholder="e.g. 100"
          placeholderTextColor="#999999"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.button, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Save</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 24, paddingBottom: 48 },
  label: { fontSize: 16, fontWeight: '600', color: '#000000', marginTop: 20 },
  help: { fontSize: 14, color: '#666666', marginTop: 4, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#cccccc', borderRadius: 8, padding: 12, fontSize: 16, color: '#000000' },
  error: { color: '#c62828', marginTop: 16 },
  button: { backgroundColor: '#000000', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 32 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});