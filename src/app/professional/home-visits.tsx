import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AddressInput } from '../../components/address-input';
import { Place } from '../../lib/maps';
import { supabase } from '../../lib/supabase';

function toNumber(text: string) {
  return Number(text.replace(',', '.'));
}

export default function HomeVisits() {
  const [base, setBase] = useState<Place | null>(null);
  const [area, setArea] = useState('');
  const [baseFee, setBaseFee] = useState('');
  const [includedKm, setIncludedKm] = useState('');
  const [perKm, setPerKm] = useState('');
  const [maxKm, setMaxKm] = useState('');
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
          .select('location, call_out_fee, call_out_included_km, call_out_per_km, max_travel_km')
          .eq('id', user.id)
          .single(),
      ]);

      if (professional?.location) setArea(professional.location);

      if (privateData) {
        setBase({ address: privateData.base_address, lat: privateData.base_lat, lng: privateData.base_lng });

        if (professional) {
          setBaseFee(String(professional.call_out_fee));
          setIncludedKm(String(professional.call_out_included_km));
          setPerKm(String(professional.call_out_per_km));
          setMaxKm(professional.max_travel_km !== null ? String(professional.max_travel_km) : '');
        }
      }

      setLoading(false);
    }

    loadSettings();
  }, []);

  async function handleSave() {
    setError(null);

    const fee = toNumber(baseFee);
    const included = toNumber(includedKm);
    const rate = toNumber(perKm);
    const max = maxKm.trim() === '' ? null : toNumber(maxKm);

    if (!area.trim()) {
      setError('Please enter the area customers will see, like your suburb and town.');
      return;
    }
    if (!base) {
      setError('Please search for your address and choose it from the list.');
      return;
    }
    if (baseFee === '' || isNaN(fee) || fee < 0) {
      setError('Please enter your call-out fee. Use 0 if you don\u2019t charge one.');
      return;
    }
    if (includedKm === '' || isNaN(included) || included < 0) {
      setError('Please enter how many km your call-out fee covers. Use 0 if it covers none.');
      return;
    }
    if (perKm === '' || isNaN(rate) || rate < 0) {
      setError('Please enter your charge per extra km. Use 0 if you don\u2019t charge extra.');
      return;
    }
    if (max !== null && (isNaN(max) || max <= 0)) {
      setError('Please enter a maximum distance above 0, or leave it empty for no limit.');
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

    const { error: settingsError } = await supabase
      .from('professionals')
      .update({
        location: area.trim(),
        call_out_fee: fee,
        call_out_included_km: included,
        call_out_per_km: rate,
        max_travel_km: max,
      })
      .eq('id', user.id);

    setSaving(false);

    if (settingsError) {
      setError(settingsError.message);
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
        <Text style={styles.label}>Your area</Text>
        <Text style={styles.help}>Shown to customers, so they know roughly where you are.</Text>
        <TextInput
          style={styles.input}
          value={area}
          onChangeText={setArea}
          placeholder="e.g. Riverside, Mbombela"
          placeholderTextColor="#999999"
        />

        <Text style={styles.label}>Where do you travel from?</Text>
        <Text style={styles.help}>
          Used to work out distances and travel times. It's private: customers never see it.
        </Text>
        <AddressInput value={base} onChange={setBase} />

        <Text style={styles.sectionTitle}>Home visit pricing</Text>

        <Text style={styles.label}>Call-out fee (R)</Text>
        <Text style={styles.help}>Added to every home visit.</Text>
        <TextInput style={styles.input} value={baseFee} onChangeText={setBaseFee} keyboardType="decimal-pad" />

        <Text style={styles.label}>Distance covered by the call-out fee (km)</Text>
        <TextInput style={styles.input} value={includedKm} onChangeText={setIncludedKm} keyboardType="decimal-pad" />

        <Text style={styles.label}>Charge per extra km (R)</Text>
        <Text style={styles.help}>Added for each km beyond the distance above.</Text>
        <TextInput style={styles.input} value={perKm} onChangeText={setPerKm} keyboardType="decimal-pad" />

        <Text style={styles.label}>Maximum distance you travel (km)</Text>
        <Text style={styles.help}>Customers further away can't book you for home visits. Leave empty for no limit.</Text>
        <TextInput style={styles.input} value={maxKm} onChangeText={setMaxKm} keyboardType="decimal-pad" />

        <Text style={styles.note}>
          Distances are measured in a straight line from where you travel from, which is usually a little shorter than the drive.
        </Text>

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
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000000', marginTop: 32 },
  label: { fontSize: 16, fontWeight: '600', color: '#000000', marginTop: 20 },
  help: { fontSize: 14, color: '#666666', marginTop: 4, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#cccccc', borderRadius: 8, padding: 12, fontSize: 16, color: '#000000', marginTop: 4 },
  note: { fontSize: 13, color: '#666666', marginTop: 20 },
  error: { color: '#c62828', marginTop: 16 },
  button: { backgroundColor: '#000000', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 32 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});