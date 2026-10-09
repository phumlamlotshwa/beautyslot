import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Toggle } from '../../components/toggle';
import { AddressInput } from '../../components/address-input';
import { formatPrice } from '../../lib/format';
import { Place } from '../../lib/maps';
import { supabase } from '../../lib/supabase';
import { colors, fonts, radius, spacing } from '../../lib/theme';
import { ui } from '../../lib/ui';

function toNumber(text: string) {
  return Number(text.replace(',', '.'));
}

const PREVIEW_DISTANCES = [5, 15, 30];

export default function HomeVisits() {
  const [base, setBase] = useState<Place | null>(null);
  const [savedArea, setSavedArea] = useState('');
  const [baseFee, setBaseFee] = useState('');
  const [chargeByDistance, setChargeByDistance] = useState(false);
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

      if (professional?.location) setSavedArea(professional.location);

      if (privateData) {
        setBase({ address: privateData.base_address, lat: privateData.base_lat, lng: privateData.base_lng });

        if (professional) {
          setBaseFee(String(professional.call_out_fee));
          setMaxKm(professional.max_travel_km !== null ? String(professional.max_travel_km) : '');

          if (Number(professional.call_out_per_km) > 0) {
            setChargeByDistance(true);
            setIncludedKm(String(professional.call_out_included_km));
            setPerKm(String(professional.call_out_per_km));
          }
        }
      }

      setLoading(false);
    }

    loadSettings();
  }, []);

  const area = base?.area || savedArea;

  const fee = toNumber(baseFee);
  const included = chargeByDistance ? toNumber(includedKm || '0') : 0;
  const rate = chargeByDistance ? toNumber(perKm) : 0;
  const max = maxKm.trim() === '' ? null : toNumber(maxKm);
  const pricingValid =
    baseFee !== '' && !isNaN(fee) && (!chargeByDistance || (perKm !== '' && !isNaN(rate) && !isNaN(included)));

  async function handleSave() {
    setError(null);

    if (!base) {
      setError('Please search for your address and choose it from the list.');
      return;
    }
    if (baseFee === '' || isNaN(fee) || fee < 0) {
      setError('Please enter your call-out fee. Use 0 if you don\u2019t charge one.');
      return;
    }
    if (chargeByDistance) {
      if (perKm === '' || isNaN(rate) || rate <= 0) {
        setError('Please enter your charge per extra km, or switch off charging extra for distance.');
        return;
      }
      if (isNaN(included) || included < 0) {
        setError('Please enter how many km your call-out fee covers, or leave it empty for none.');
        return;
      }
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
        ...(area ? { location: area } : {}),
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
      <View style={ui.centered}>
        <ActivityIndicator size="large" color={colors.accentDark} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={ui.screen}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="location-outline" size={20} color={colors.accentDark} />
            <Text style={styles.cardTitle}>Where you work from</Text>
          </View>
          <Text style={styles.cardHelp}>Your full address is private. Customers only see your area.</Text>
          <AddressInput value={base} onChange={setBase} />
          {area ? (
            <View style={styles.areaRow}>
              <Ionicons name="eye-outline" size={15} color={colors.accentDark} />
              <Text style={styles.areaText}>Customers will see: {area}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="car-outline" size={20} color={colors.accentDark} />
            <Text style={styles.cardTitle}>House call pricing</Text>
          </View>

          <Text style={styles.fieldLabel}>Call-out fee (R)</Text>
          <TextInput style={ui.input} value={baseFee} onChangeText={setBaseFee} keyboardType="decimal-pad" />
          <Text style={styles.fieldHelp}>Added to every house call. Enter 0 if you don't charge one.</Text>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Charge extra for longer distances</Text>
              <Text style={styles.fieldHelp}>Off means everyone pays the same call-out fee.</Text>
            </View>
            <Toggle value={chargeByDistance} onValueChange={setChargeByDistance} />
          </View>

          {chargeByDistance && (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Fee covers the first (km)</Text>
                <TextInput
                  style={ui.input}
                  value={includedKm}
                  onChangeText={setIncludedKm}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textFaint}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Per extra km (R)</Text>
                <TextInput style={ui.input} value={perKm} onChangeText={setPerKm} keyboardType="decimal-pad" />
              </View>
            </View>
          )}

          <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Max distance (km)</Text>
          <TextInput
            style={ui.input}
            value={maxKm}
            onChangeText={setMaxKm}
            keyboardType="decimal-pad"
            placeholder="No limit"
            placeholderTextColor={colors.textFaint}
          />
          <Text style={styles.fieldHelp}>Optional. Customers further away can't book you for house calls.</Text>

          {pricingValid && (
            <View style={styles.preview}>
              <Text style={styles.previewTitle}>With your prices</Text>
              {PREVIEW_DISTANCES.map((km) => {
                const outOfRange = max !== null && !isNaN(max) && km > max;
                const total = fee + rate * Math.max(0, km - included);
                return (
                  <Text key={km} style={styles.previewLine}>
                    A customer {km} km away {outOfRange ? "can't book a house call" : `would pay ${formatPrice(total)}`}
                  </Text>
                );
              })}
            </View>
          )}

          <Text style={styles.note}>
            Distances are measured in a straight line from where you work, which is usually a little shorter than the drive.
          </Text>
        </View>

        {error && <Text style={ui.error}>{error}</Text>}

        <Pressable style={[ui.button, saving && ui.buttonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={ui.buttonText}>Save</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  cardTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  cardHelp: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginBottom: spacing.md },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md },
  areaText: { fontFamily: fonts.medium, fontSize: 14, color: colors.accentDark },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  fieldLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.text, marginTop: spacing.md, marginBottom: 6 },
  fieldHelp: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  switchLabel: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  preview: { backgroundColor: colors.accentSoft, borderRadius: radius.sm, padding: spacing.md, marginTop: spacing.lg },
  previewTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.accentDark, marginBottom: 4 },
  previewLine: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, marginTop: 2 },
  note: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: spacing.md },
});