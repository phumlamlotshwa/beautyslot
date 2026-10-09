// BeautySlot colours. Light and dark use the same names, so a screen
// can switch between them without changing anything else.

export const lightColors = {
  background: '#EFEFEF',
  surface: '#FFFFFF',
  text: '#000000',
  textMuted: '#5E5E5E',
  textFaint: '#999999',
  border: '#DADADA',
  switchOff: '#B8B8B8',

  accent: '#3A3A3A',
  accentDark: '#000000',
  accentSoft: '#E2E2E2',
  onAccent: '#FFFFFF',

  header: '#000000',
  onHeader: '#FFFFFF',
  onHeaderMuted: '#A3A3A3',
  badge: '#D23B2B',

  danger: '#C2392B',
  dangerSoft: '#F7E2DF',
  warning: '#8A5A00',
  warningSoft: '#F3E9D6',
  info: '#4A4FA3',
  infoSoft: '#E6E7F4',
  completed: '#2E5D8A',
  completedSoft: '#E0E9F2',
};

export type Colors = typeof lightColors;

export const darkColors: Colors = {
  background: '#000000',
  surface: '#1A1A1A',
  text: '#FFFFFF',
  textMuted: '#A3A3A3',
  textFaint: '#6E6E6E',
  border: '#2E2E2E',
  switchOff: '#4D4D4D',

  accent: '#D6D6D6',
  accentDark: '#FFFFFF',
  accentSoft: '#2A2A2A',
  onAccent: '#000000',

  header: '#000000',
  onHeader: '#FFFFFF',
  onHeaderMuted: '#9A9A9A',
  badge: '#E5483A',

  danger: '#FF7A6B',
  dangerSoft: '#3A1E1B',
  warning: '#F0B451',
  warningSoft: '#3A2D16',
  info: '#B0B3FF',
  infoSoft: '#24264A',
  completed: '#93BDEB',
  completedSoft: '#1B2A3B',
};

// Screens that haven't been switched to useStyles() yet read this one.
// It stays light until each screen is converted.
export const colors = lightColors;

export const fonts = {
  regular: 'Archivo_400Regular',
  medium: 'Archivo_500Medium',
  semiBold: 'Archivo_600SemiBold',
  bold: 'Archivo_700Bold',
  extraBold: 'Archivo_800ExtraBold',
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};