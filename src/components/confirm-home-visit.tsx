import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { getTravelTime, Point, TravelTime } from '../lib/maps';
import { supabase } from '../lib/supabase';
import { fonts, radius, spacing } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';
import { useUi } from '../lib/ui';

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
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();
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
        setError('Add your base address under House calls to see travel times. You can still set a buffer yourself.');
        setLoading(false);
        return;
      }

      try {
        const result = await getTravelTime({ lat: base.base_lat, lng: base.base_lng }, destination);
        if (cancelled) return;
        setEstimate(result);
        setBuffer(Math.min(MAX_BUFFER, Math.ceil(result.minutes / STEP) * STEP));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "The travel time isn't available right now. Set the buffer yourself.");
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
      setError(e instanceof Error ? e.message : "The booking wasn't confirmed. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Confirm house call</Text>
        <View style={styles.addressRow}>
          <Ionicons name="home-outline" size={16} color={colors.textMuted} />
          <Text style={styles.address}>{address}</Text>
        </View>

        <View style={styles.estimateBox}>
          {loading ? (
            <ActivityIndicator color={colors.text} />
          ) : estimate ? (
            <View style={styles.estimateRow}>
              <Ionicons name="car-outline" size={20} color={colors.text} />
              <Text style={styles.estimate}>
                About {estimate.minutes} min ({estimate.km} km) from your base
              </Text>
            </View>
          ) : (
            <Text style={styles.estimateMissing}>No travel time yet</Text>
          )}
        </View>

        <Text style={styles.label}>Travel buffer before and after</Text>
        <View style={styles.stepper}>
          <Pressable
            style={[styles.stepButton, buffer <= 0 && styles.stepButtonDisabled]}
            onPress={() => setBuffer((b) => Math.max(0, b - STEP))}
            disabled={buffer <= 0}
          >
            <Ionicons name="remove" size={22} color={buffer <= 0 ? colors.border : colors.text} />
          </Pressable>
          <Text style={styles.bufferValue}>{buffer} min</Text>
          <Pressable
            style={[styles.stepButton, buffer >= MAX_BUFFER && styles.stepButtonDisabled]}
            onPress={() => setBuffer((b) => Math.min(MAX_BUFFER, b + STEP))}
            disabled={buffer >= MAX_BUFFER}
          >
            <Ionicons name="add" size={22} color={buffer >= MAX_BUFFER ? colors.border : colors.text} />
          </Pressable>
        </View>
        <Text style={styles.help}>
          This time is blocked before and after the appointment, so nobody can book you while you travel.
        </Text>

        {error && <Text style={ui.error}>{error}</Text>}

        <Pressable style={[ui.button, saving && ui.buttonDisabled]} onPress={handleConfirm} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={ui.buttonText}>Confirm booking</Text>}
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={onCancel} disabled={saving}>
          <Text style={styles.cancelText}>Not now</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 40,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.lg },
  title: { fontFamily: fonts.extraBold, fontSize: 22, color: colors.text },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm },
  address: { flex: 1, fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.textMuted },
  estimateBox: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.lg, alignItems: 'center' },
  estimateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  estimate: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.text },
  estimateMissing: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted },
  label: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text, marginTop: spacing.xl, textAlign: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.md },
  stepButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.accentDark,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonDisabled: { borderColor: colors.border },
  bufferValue: { fontFamily: fonts.extraBold, fontSize: 26, color: colors.text, minWidth: 100, textAlign: 'center' },
  help: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' },
  cancelButton: { padding: 14, alignItems: 'center', marginTop: spacing.xs },
  cancelText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.textMuted },
}));