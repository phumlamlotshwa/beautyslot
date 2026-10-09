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
import { fonts, radius, spacing } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';
import { useUi } from '../lib/ui';

type Props = {
  visible: boolean;
  title: string;
  initial?: string;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (name: string) => Promise<void>;
};

export function NameDialog({ visible, title, initial = '', submitLabel, onCancel, onSubmit }: Props) {
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();
  const [name, setName] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName(initial);
      setError(null);
    }
  }, [visible, initial]);

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Give it a name.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSubmit(name.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={ui.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Braids"
            placeholderTextColor={colors.textFaint}
            maxLength={40}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          {error && <Text style={ui.error}>{error}</Text>}

          <View style={styles.buttons}>
            <Pressable style={styles.cancel} onPress={onCancel} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.submit, saving && ui.buttonDisabled]} onPress={handleSubmit} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={styles.submitText}>{submitLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', padding: spacing.xl },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginBottom: spacing.md },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  cancel: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
  },
  cancelText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  submit: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.accentDark },
  submitText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.onAccent },
}));