import { Link } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { fonts, spacing } from '../lib/theme';
import { makeStyles } from '../lib/theme-context';

export function PrivacyLink() {
  const styles = useStyles();

  return (
    <Link href="/privacy" asChild>
      <Pressable style={styles.button} hitSlop={8}>
        <Text style={styles.text}>Privacy policy</Text>
      </Pressable>
    </Link>
  );
}

const useStyles = makeStyles((colors) => ({
  button: { alignSelf: 'center', paddingVertical: spacing.sm, marginTop: spacing.lg },
  text: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted, textDecorationLine: 'underline' },
}));