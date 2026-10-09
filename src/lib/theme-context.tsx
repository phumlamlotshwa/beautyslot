import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { Colors, darkColors, lightColors } from './theme';

// What the person picked on their profile.
// 'system' means "Match my phone".
export type ThemeChoice = 'light' | 'dark' | 'system';

type ThemeValue = {
  choice: ThemeChoice;
  scheme: 'light' | 'dark';
  colors: Colors;
  setChoice: (choice: ThemeChoice) => void;
};

const STORAGE_KEY = 'beautyslot-theme';

const ThemeContext = createContext<ThemeValue>({
  choice: 'system',
  scheme: 'light',
  colors: lightColors,
  setChoice: () => {},
});

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const phoneScheme = useColorScheme();
  const [choice, setChoiceState] = useState<ThemeChoice>('system');

  // Load the saved choice once, when the app opens
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setChoiceState(saved);
      }
    });
  }, []);

  function setChoice(next: ThemeChoice) {
    setChoiceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }

  const scheme = choice === 'system' ? (phoneScheme === 'dark' ? 'dark' : 'light') : choice;
  const colors = scheme === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ choice, scheme, colors, setChoice }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Use inside any screen: const { colors, scheme } = useTheme();
export function useTheme() {
  return useContext(ThemeContext);
}

// Builds a screen's styles twice, once with each set of colours,
// and hands back whichever matches the current theme.
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  build: (colors: Colors) => T & StyleSheet.NamedStyles<any>
) {
  const light = StyleSheet.create(build(lightColors));
  const dark = StyleSheet.create(build(darkColors));

  return function useStyles() {
    const { scheme } = useTheme();
    return scheme === 'dark' ? dark : light;
  };
}