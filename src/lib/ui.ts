import { StyleSheet } from 'react-native';
import { makeStyles } from './theme-context';
import { Colors, fonts, lightColors, radius, spacing } from './theme';

function buildUi(colors: Colors) {
  return {
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.xl, paddingBottom: 48 },
    centered: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },

    title: { fontFamily: fonts.extraBold, fontSize: 28, lineHeight: 32, letterSpacing: -0.4, color: colors.text, marginBottom: spacing.lg },
    sectionTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginTop: 28, marginBottom: spacing.md },
    label: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, marginTop: spacing.lg, marginBottom: 6 },
    body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.text },
    muted: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
    help: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted, marginTop: spacing.sm },
    error: { fontFamily: fonts.medium, fontSize: 14, color: colors.danger, marginTop: spacing.md },

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

    button: { backgroundColor: colors.accentDark, borderRadius: 10, padding: spacing.lg, alignItems: 'center', marginTop: spacing.xl },
    buttonDisabled: { opacity: 0.4 },
    buttonText: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.onAccent },

    outlineButton: { borderWidth: 1.5, borderColor: colors.accentDark, borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: spacing.md },
    outlineButtonText: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.accentDark },

    dangerButton: { borderWidth: 1.5, borderColor: colors.danger, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: spacing.md },
    dangerButtonText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.danger },

    card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },

    chip: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentSoft, borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
    chipSelected: { backgroundColor: colors.accentDark, borderColor: colors.accentDark },
    chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
    chipTextSelected: { color: colors.onAccent },

    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
    avatarText: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  } as const;
}

export const useUi = makeStyles(buildUi);

export const ui = StyleSheet.create(buildUi(lightColors));