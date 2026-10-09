import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { fonts, radius, spacing } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';

const ROW_HEIGHT = 50;

export type SelectOption<T> = { value: T; label: string };

type Props<T> = {
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  title?: string;
};

export function SelectField<T>({ value, options, onChange, placeholder = 'Choose', title }: Props<T>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex].label : null;

  return (
    <>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={[styles.fieldText, !selectedLabel && styles.placeholder]}>{selectedLabel ?? placeholder}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          {title && <Text style={styles.title}>{title}</Text>}
          <FlatList
            data={options}
            keyExtractor={(o) => String(o.value)}
            initialScrollIndex={Math.max(selectedIndex, 0)}
            getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
            renderItem={({ item }) => {
              const isSelected = item.value === value;
              return (
                <Pressable
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{item.label}</Text>
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  fieldText: { fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  placeholder: { color: colors.textFaint },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  sheet: {
    height: 380,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  option: { height: ROW_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  optionSelected: { backgroundColor: colors.accentSoft },
  optionText: { fontFamily: fonts.regular, fontSize: 17, color: colors.text },
  optionTextSelected: { fontFamily: fonts.bold, color: colors.text },
}));