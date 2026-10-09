import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { formatPrice } from '../lib/format';
import { fonts, radius, spacing } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';
import { useUi } from '../lib/ui';

type Props = {
  visible: boolean;
  customerName: string;
  usualPrice: number;
  onCancel: () => void;
  onConfirm: (price: number, reason: string | null) => Promise<void>;
};

export function PriceSheet({ visible, customerName, usualPrice, onCancel, onConfirm }: Props) {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();
  const [price, setPrice] = useState(String(usualPrice));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setPrice(String(usualPrice));
      setReason('');
      setError(null);
    }
  }, [visible, usualPrice]);

  const value = Number(price.replace(',', '.'));
  const valid = price.trim() !== '' && !isNaN(value) && value >= 0;
  const higher = valid && value > usualPrice;
  const changed = valid && value !== usualPrice;

  async function handleConfirm() {
    if (!valid) {
      setError('Use numbers only, like 450.');
      return;
    }
    if (changed && !reason.trim()) {
      setError(`Let ${customerName} know why the price is different.`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onConfirm(value, changed ? reason.trim() : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Price for this booking</Text>
          <Text style={styles.usual}>Usual price {formatPrice(usualPrice)}</Text>

          <Text style={ui.label}>Price (R)</Text>
          <TextInput
            style={ui.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.textFaint}
            selectTextOnFocus
          />

          {changed && (
            <>
              <Text style={ui.label}>Reason</Text>
              <TextInput
                style={[ui.input, styles.reasonInput]}
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. Waist length takes about 2 more hours"
                placeholderTextColor={colors.textFaint}
                multiline
                maxLength={200}
                textAlignVertical="top"
              />
            </>
          )}

          {higher && (
            <Text style={styles.note}>
              {customerName} has to accept {formatPrice(value)} before it's confirmed.
            </Text>
          )}

          {error && <Text style={ui.error}>{error}</Text>}

          <View style={styles.buttons}>
            <Pressable style={styles.cancel} onPress={onCancel} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.confirm, saving && ui.buttonDisabled]} onPress={handleConfirm} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={styles.confirmText}>{higher ? 'Send new price' : 'Confirm'}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  usual: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: 4 },
  reasonInput: { minHeight: 72, paddingTop: 12 },
  note: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text, marginTop: spacing.md },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  cancel: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.accentSoft },
  cancelText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  confirm: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.accentDark },
  confirmText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.onAccent },
}));