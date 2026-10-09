import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { fonts } from '../lib/theme';
import { makeStyles } from '../lib/theme-context';

type Props = {
  name: string;
  url?: string | null;
  size?: number;
};

// A round photo. With no photo, it shows the first letter of the name instead.
export function Avatar({ name, url, size = 48 }: Props) {
  const styles = useStyles();
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

const useStyles = makeStyles((colors) => ({
  image: { backgroundColor: colors.accentSoft },
  fallback: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: fonts.bold, color: colors.text },
}));