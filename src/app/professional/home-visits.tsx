import { Ionicons } from '@expo/vector-icons';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Toggle } from '../../components/toggle';
import { shortAddress } from '../../lib/location';
import { supabase } from '../../lib/supabase';
import { fonts, radius, spacing } from '../../lib/theme';
import { makeStyles, useTheme } from '../../lib/theme-context';
import { useUi } from '../../lib/ui';

function toNumber(text: string) {
  return Number(text.replace(',', '.'));
}

export default function HouseCalls() {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();
  const [baseAddress, setBaseAddress] = useState<string | null>(null);
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
        supabase.from('professional_private').select('base_address').eq('professional_id', user.id).maybeSingle(),
        supabase
          .from('professionals')
          .select('call_out_fee, call_out_included_km, call_out_per_km, max_travel_km')
          .eq('id', user.id)
          .single(),
      ]);

      if (privateData && professional) {
        setBaseFee(String(professional.call_out_fee));
        setMaxKm(professional.max_travel_km !== null ? String(professional.max_travel_km) : '');

        if (Number(professional.call_out_per_km) > 0) {
          setChargeByDistance(true);
          setIncludedKm(String(professional.call_out_included_km));
          setPerKm(String(professional.call_out_per_km));
        }
      }

      setLoading(false);
    }

    loadSettings();
  }, []);

  useFocusEffect(
    useCallback(() => {
      async function loadAddress() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('professional_private')
          .select('base_address')
          .eq('professional_id', user.id)
          .maybeSingle();

        setBaseAddress(data?.base_address ?? null);
      }

      loadAddress();
    }, [])
  );

  const fee = toNumber(baseFee);
  const included = chargeByDistance ? toNumber(includedKm || '0') : 0;
  const rate = chargeByDistance ? toNumber(perKm) : 0;
  const max = maxKm.trim() === '' ? null : toNumber(maxKm);

  async function handleSave() {
    setError(null);

    if (!baseAddress) {
      setError('Add your business address first.');
      return;
    }
    if (baseFee === '' || isNaN(fee) || fee < 0) {
      setError("Add your call-out fee. Put 0 if you don't charge one.");
      return;
    }
    if (chargeByDistance) {
      if (perKm === '' || isNaN(rate) || rate <= 0) {
        setError('Add what you charge per extra km, or switch off charging extra for distance.');
        return;
      }
      if (isNaN(included) || included < 0) {
        setError('Add how many km your call-out fee covers, or leave it empty for none.');
        return;
      }
    }
    if (max !== null && (isNaN(max) || max <= 0)) {
      setError('Set a maximum distance above 0, or leave it empty for no limit.');
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('Log in again to save.');
      setSaving(false);
      return;
    }

    const { error: settingsError } = await supabase
      .from('professionals')
      .update({
        call_out_fee: fee,
        call_out_included_km: included,
        call_out_per_km: rate,
        max_travel_km: max,
      })
      .eq('id', user.id);

    setSaving(false);

    if (settingsError) {
      setError("Your prices weren't saved. Check your connection and try again.");
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
        <Link href="/professional/address" asChild>
          <Pressable style={styles.addressRow}>
            <Ionicons name="location-outline" size={20} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressTitle}>Business address</Text>
              <Text style={styles.addressText}>{baseAddress ? shortAddress(baseAddress) : 'Not added yet'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Link>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="car-outline" size={20} color={colors.text} />
            <Text style={styles.cardTitle}>House call pricing</Text>
          </View>

          <Text style={styles.fieldLabel}>Call-out fee (R)</Text>
          <TextInput style={ui.input} value={baseFee} onChangeText={setBaseFee} keyboardType="decimal-pad" />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Charge extra for longer distances</Text>
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
        </View>

        {error && <Text style={ui.error}>{error}</Text>}

        <Pressable style={[ui.button, saving && ui.buttonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={ui.buttonText}>Save</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  cardTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  addressTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  addressText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: 2 },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  fieldLabel: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text, marginTop: spacing.md, marginBottom: 6 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  switchLabel: { flex: 1, fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
}));