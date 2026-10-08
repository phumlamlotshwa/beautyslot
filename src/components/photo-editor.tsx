import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../lib/theme';
import { ui } from '../lib/ui';

type Catalogue = { id: number; name: string };

type Props = {
  visible: boolean;
  imageUrl: string | null;
  caption: string | null;
  catalogueId: number | null;
  catalogues: Catalogue[];
  onClose: () => void;
  onSave: (caption: string | null, catalogueId: number | null) => Promise<void>;
  onDelete: () => void;
};

export function PhotoEditor({ visible, imageUrl, caption, catalogueId, catalogues, onClose, onSave, onDelete }: Props) {
  const [text, setText] = useState(caption ?? '');
  const [selected, setSelected] = useState<number | null>(catalogueId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setText(caption ?? '');
      setSelected(catalogueId);
      setError(null);
    }
  }, [visible, caption, catalogueId]);

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      await onSave(text.trim() || null, selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your changes.');
    } finally {
      setSaving(false);
    }
  }

  const options: { id: number | null; name: string }[] = [...catalogues, { id: null, name: 'Other' }];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.topTitle}>Edit photo</Text>
          <Pressable onPress={onDelete} hitSlop={10}>
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {imageUrl && <Image source={{ uri: imageUrl }} style={styles.image} contentFit="contain" />}

          <Text style={ui.label}>Description (optional)</Text>
          <TextInput
            style={[ui.input, styles.captionInput]}
            value={text}
            onChangeText={setText}
            placeholder="e.g. Knotless braids, mid-back length"
            placeholderTextColor={colors.textFaint}
            multiline
            maxLength={200}
          />
          <Text style={styles.counter}>{text.length}/200</Text>

          <Text style={ui.label}>Catalogue</Text>
          <View style={styles.wrap}>
            {options.map((c) => (
              <Pressable
                key={String(c.id)}
                style={[ui.chip, selected === c.id && ui.chipSelected]}
                onPress={() => setSelected(c.id)}
              >
                <Text style={[ui.chipText, selected === c.id && ui.chipTextSelected]}>{c.name}</Text>
              </Pressable>
            ))}
          </View>

          {error && <Text style={ui.error}>{error}</Text>}

          <Pressable style={[ui.button, saving && ui.buttonDisabled]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={ui.buttonText}>Save</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.md },
  topTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  content: { padding: spacing.xl, paddingTop: 0, paddingBottom: 48 },
  image: { width: '100%', aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  captionInput: { minHeight: 80, textAlignVertical: 'top' },
  counter: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint, textAlign: 'right', marginTop: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});