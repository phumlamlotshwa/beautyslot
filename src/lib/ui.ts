import { StyleSheet } from 'react-native';
import { colors, fonts, radius, spacing } from './theme';

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: 48 },
  centered: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },

  title: { fontFamily: fonts.bold, fontSize: 26, color: colors.text, marginBottom: spacing.lg },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginTop: 28, marginBottom: spacing.md },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.text, marginTop: spacing.lg, marginBottom: 6 },
  body: { fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  muted: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  help: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: spacing.sm },
  error: { fontFamily: fonts.regular, fontSize: 14, color: colors.danger, marginTop: spacing.md },

  input: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
  },

  button: { backgroundColor: colors.accentDark, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.xl },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontFamily: fonts.medium, fontSize: 16, color: colors.onAccent },

  outlineButton: { borderWidth: 1, borderColor: colors.accentDark, borderRadius: radius.md, padding: 14, alignItems: 'center', marginBottom: spacing.md },
  outlineButtonText: { fontFamily: fonts.medium, fontSize: 16, color: colors.accentDark },

  dangerButton: { borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, padding: 14, alignItems: 'center', marginTop: spacing.md },
  dangerButtonText: { fontFamily: fonts.medium, fontSize: 15, color: colors.danger },

  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },

  chip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  chipSelected: { backgroundColor: colors.accentDark, borderColor: colors.accentDark },
  chipText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  chipTextSelected: { color: colors.onAccent },

  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  avatarText: { fontFamily: fonts.bold, fontSize: 20, color: colors.accentDark },
});