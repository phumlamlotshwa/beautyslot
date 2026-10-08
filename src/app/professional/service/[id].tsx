import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ServiceForm, ServiceValues } from '../../../components/service-form';
import { OfferedAt } from '../../../lib/format';
import { supabase } from '../../../lib/supabase';
import { colors, fonts, spacing } from '../../../lib/theme';
import { ui } from '../../../lib/ui';

export default function EditService() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [initial, setInitial] = useState<ServiceValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadService() {
      const { data, error: loadError } = await supabase
        .from('services')
        .select('name, category, offered_at, price, duration_minutes')
        .eq('id', id)
        .single();

      if (loadError || !data) {
        setError(loadError?.message ?? 'Service not found.');
      } else {
        setInitial({
          name: data.name,
          category: data.category,
          offeredAt: data.offered_at as OfferedAt,
          price: Number(data.price),
          durationMinutes: data.duration_minutes,
        });
      }

      setLoading(false);
    }

    loadService();
  }, [id]);

  async function handleSave(values: ServiceValues) {
    const { error: saveError } = await supabase
      .from('services')
      .update({
        name: values.name,
        category: values.category,
        offered_at: values.offeredAt,
        price: values.price,
        duration_minutes: values.durationMinutes,
      })
      .eq('id', id);

    if (saveError) throw new Error(saveError.message);

    router.back();
  }

  function handleDelete() {
    Alert.alert('Delete service', `Are you sure you want to delete "${initial?.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: deleteService },
    ]);
  }

  async function deleteService() {
    setError(null);
    setDeleting(true);

    const { error: deleteError } = await supabase.from('services').delete().eq('id', id);

    setDeleting(false);

    if (deleteError) {
      setError(
        deleteError.code === '23503'
          ? "This service has bookings, so it can't be deleted."
          : deleteError.message
      );
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

  if (!initial) {
    return (
      <View style={[ui.screen, ui.content]}>
        <Text style={ui.error}>{error}</Text>
      </View>
    );
  }

  return (
    <ServiceForm initial={initial} submitLabel="Save changes" onSubmit={handleSave}>
      {error && <Text style={ui.error}>{error}</Text>}
      <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={deleting}>
        {deleting ? (
          <ActivityIndicator color={colors.danger} />
        ) : (
          <>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={styles.deleteText}>Delete service</Text>
          </>
        )}
      </Pressable>
    </ServiceForm>
  );
}

const styles = StyleSheet.create({
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg, marginTop: spacing.md },
  deleteText: { fontFamily: fonts.medium, fontSize: 15, color: colors.danger },
});