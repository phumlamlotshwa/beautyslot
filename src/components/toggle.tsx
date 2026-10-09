import { Switch } from 'react-native';
import { useTheme } from '../lib/theme-context';

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function Toggle({ value, onValueChange }: Props) {
  const { colors, scheme } = useTheme();

  // In dark mode the "on" track is white, so the round knob turns black
  // when it's on. Otherwise you'd have a white knob on a white track.
  const knob = scheme === 'dark' && value ? '#000000' : '#FFFFFF';

  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ true: colors.accentDark, false: colors.switchOff }}
      ios_backgroundColor={colors.switchOff}
      thumbColor={knob}
    />
  );
}