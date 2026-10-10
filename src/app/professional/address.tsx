import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { AddressInput } from '../../components/address-input';
import { Place } from '../../lib/maps';
import { supabase } from '../../lib/supabase';
import { radius, spacing } from '../../lib/theme';
import { makeStyles, useTheme } from '../../lib/theme-context';
import { useUi } from '../../lib/ui';

export default function BusinessAddress() {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();
  const [base, setBase] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAddress() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: privateData } = await supabase
        .from('professional_private')
        .select('base_address, base_lat, base_lng')
        .eq('professional_id', user.id)
        .maybeSingle();

      if (privateData) {
        setBase({ address: privateData.base_address, lat: privateData.base_lat, lng: privateData.base_lng });
      }

      setLoading(false);
    }

    loadAddress();
  }, []);

  async function handleSave() {
    setError(null);

    if (!base) {
      setError('Search for your address and pick it from the list.');
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('Log in again to save.');
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
      setError("Your address wasn't saved. Check your connection and try again.");
      setSaving(false);
      return;
    }

    if (base.area) {
      const { error: areaError } = await supabase
        .from('professionals')
        .update({ location: base.area })
        .eq('id', user.id);

      if (areaError) {
        setError("Your address wasn't saved. Check your connection and try again.");
        setSaving(false);
        return;
      }
    }

    setSaving(false);
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
    <KeyboardAvoidingView style={ui.screen} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <AddressInput value={base} onChange={setBase} />
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
}));