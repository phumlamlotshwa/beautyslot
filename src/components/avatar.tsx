import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';

type Props = {
  name: string;
  url?: string | null;
  size?: number;
};

export function Avatar({ name, url, size = 48 }: Props) {
  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (url) {
    return <Image source={{ uri: url }} style={[styles.image, circle]} contentFit="cover" transition={150} />;
  }

  return (
    <View style={[styles.fallback, circle]}>
      <Text style={[styles.letter, { fontSize: size * 0.4 }]}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.accentSoft },
  fallback: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: fonts.bold, color: colors.accentDark },
});