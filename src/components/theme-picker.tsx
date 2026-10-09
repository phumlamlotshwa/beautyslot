import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fonts, radius, spacing } from '../lib/theme';
import { makeStyles, ThemeChoice, useTheme } from '../lib/theme-context';

type IconName = ComponentProps<typeof Ionicons>['name'];

const options: { value: ThemeChoice; label: string; icon: IconName }[] = [
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
  { value: 'system', label: 'Same as phone', icon: 'phone-portrait-outline' },
];

export function ThemePicker() {
  const styles = useStyles();
  const { colors, choice, setChoice } = useTheme();

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Appearance</Text>
      <View style={styles.row}>
        {options.map((o) => {
          const on = choice === o.value;
          return (
            <Pressable key={o.value} style={[styles.option, on && styles.optionOn]} onPress={() => setChoice(o.value)}>
              <Ionicons name={o.icon} size={20} color={on ? colors.onAccent : colors.text} />
              <Text style={[styles.optionText, on && styles.optionTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.lg },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  option: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
  },
  optionOn: { backgroundColor: colors.accentDark },
  optionText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  optionTextOn: { color: colors.onAccent },
}));