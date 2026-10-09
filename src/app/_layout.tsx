import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/archivo';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'react-native';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { fonts } from '../lib/theme';
import { AppThemeProvider, useTheme } from '../lib/theme-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  return (
    <AppThemeProvider>
      <AppStack />
    </AppThemeProvider>
  );
}

function AppStack() {
  const { scheme, colors } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accentDark,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <AnimatedSplashOverlay />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.accentDark,
          headerTitleStyle: { fontFamily: fonts.bold, color: colors.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="sign-up" options={{ title: 'Sign up' }} />
        <Stack.Screen name="login" options={{ title: 'Log in' }} />
        <Stack.Screen
          name="customer/index"
          options={{ headerShown: false, gestureEnabled: false }}
        />
               <Stack.Screen
          name="professional/index"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen name="professional/add-service" options={{ title: 'Add service' }} />
        <Stack.Screen name="professional/service/[id]" options={{ title: 'Edit service' }} />
        <Stack.Screen name="customer/professional/[id]" options={{ title: 'Profile' }} />
        <Stack.Screen name="professional/hours/index" options={{ title: 'Working hours' }} />
        <Stack.Screen name="professional/hours/[staffId]" options={{ title: 'Working hours' }} />
        <Stack.Screen name="customer/book/[serviceId]" options={{ title: 'Book' }} />
        <Stack.Screen name="customer/bookings" options={{ title: 'My bookings' }} />
        <Stack.Screen name="professional/bookings" options={{ title: 'Bookings' }} />
        <Stack.Screen name="chat/[conversationId]" options={{ title: 'Chat' }} />
        <Stack.Screen name="messages" options={{ title: 'Messages' }} />
        <Stack.Screen name="professional/home-visits" options={{ title: 'House calls' }} />
        <Stack.Screen name="professional/reschedule/[bookingId]" options={{ title: 'Suggest a new time' }} />
        <Stack.Screen name="professional/profile" options={{ title: 'My profile' }} />
        <Stack.Screen name="customer/profile" options={{ title: 'My profile' }} />
        <Stack.Screen name="professional/team/index" options={{ title: 'My team' }} />
        <Stack.Screen name="professional/team/[staffId]" options={{ title: 'Team member' }} />
      </Stack>
    </ThemeProvider>
  );
}