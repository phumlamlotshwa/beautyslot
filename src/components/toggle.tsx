import { Switch } from 'react-native';
import { colors } from '../lib/theme';

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function Toggle({ value, onValueChange }: Props) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ true: colors.accentDark, false: colors.switchOff }}
      ios_backgroundColor={colors.switchOff}
      thumbColor="#FFFFFF"
    />
  );
}