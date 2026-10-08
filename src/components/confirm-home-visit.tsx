import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { getTravelTime, Point, TravelTime } from '../lib/maps';
import { supabase } from '../lib/supabase';

type Props = {
  visible: boolean;
  address: string;
  destination: Point;
  onCancel: () => void;
  onConfirm: (travelMinutes: number) => Promise<void>;
};

const STEP = 5;
const MAX_BUFFER = 240;

export function ConfirmHomeVisit({ visible, address, destination, onCancel, onConfirm }: Props) {
  const [estimate, setEstimate] = useState<TravelTime | null>(null);
  const [buffer, setBuffer] = useState(30);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    async function loadTravelTime() {
      setEstimate(null);
      setError(null);
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: base } = await supabase
        .from('professional_private')
        .select('base_lat, base_lng')
        .eq('professional_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!base) {
        setError('Set your address under Home visits to see travel times. You can still set a buffer yourself.');
        setLoading(false);
        return;
      }

      try {
        const result = await getTravelTime({ lat: base.base_lat, lng: base.base_lng }, destination);
        if (cancelled) return;
        setEstimate(result);
        setBuffer(Math.min(MAX_BUFFER, Math.ceil(result.minutes / STEP) * STEP));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not work out the travel time.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTravelTime();

    return () => {
      cancelled = true;
    };
  }, [visible, destination.lat, destination.lng]);

  async function handleConfirm() {
    setError(null);
    setSaving(true);

    try {
      await onConfirm(buffer);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not confirm the booking.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Confirm home visit</Text>
        <Text style={styles.address}>{address}</Text>

        <View style={styles.estimateBox}>
          {loading ? (
            <ActivityIndicator color="#000000" />
          ) : estimate ? (
            <Text style={styles.estimate}>
              About {estimate.minutes} min · {estimate.km} km from your base
            </Text>
          ) : (
            <Text style={styles.estimateMissing}>Travel time unavailable</Text>
          )}
        </View>

        <Text style={styles.label}>Travel buffer before and after</Text>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepButton}
            onPress={() => setBuffer((b) => Math.max(0, b - STEP))}
            disabled={buffer <= 0}
          >
            <Text style={[styles.stepText, buffer <= 0 && styles.faded]}>−</Text>
          </Pressable>
          <Text style={styles.bufferValue}>{buffer} min</Text>
          <Pressable
            style={styles.stepButton}
            onPress={() => setBuffer((b) => Math.min(MAX_BUFFER, b + STEP))}
            disabled={buffer >= MAX_BUFFER}
          >
            <Text style={[styles.stepText, buffer >= MAX_BUFFER && styles.faded]}>+</Text>
          </Pressable>
        </View>
        <Text style={styles.help}>
          This time is blocked before and after the appointment so nobody can book you while you travel.
        </Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.button, saving && styles.buttonDisabled]} onPress={handleConfirm} disabled={saving}>
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Confirm booking</Text>}
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={onCancel} disabled={saving}>
          <Text style={styles.cancelText}>Not now</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  sheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '700', color: '#000000' },
  address: { fontSize: 15, color: '#666666', marginTop: 6 },
  estimateBox: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, marginTop: 16, alignItems: 'center' },
  estimate: { fontSize: 16, fontWeight: '600', color: '#000000' },
  estimateMissing: { fontSize: 15, color: '#666666' },
  label: { fontSize: 15, fontWeight: '600', color: '#000000', marginTop: 20 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 12 },
  stepButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 24, color: '#000000' },
  faded: { opacity: 0.2 },
  bufferValue: { fontSize: 22, fontWeight: '700', color: '#000000', minWidth: 90, textAlign: 'center' },
  help: { fontSize: 13, color: '#666666', marginTop: 12, textAlign: 'center' },
  error: { color: '#c62828', marginTop: 12 },
  button: { backgroundColor: '#000000', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 20 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  cancelButton: { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelText: { color: '#000000', fontSize: 15, fontWeight: '600' },
});