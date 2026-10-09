import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';

type Props = {
  count: number;
};

// A small red circle with a number, e.g. on the Bookings button.
// Shows nothing when the count is 0.
export function CountBadge({ count }: Props) {
  if (count <= 0) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 15, color: colors.onAccent },
});