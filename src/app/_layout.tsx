import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold, useFonts } from '@expo-google-fonts/dm-sans';
import { colors, fonts } from '../lib/theme';
import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
    const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  if (!fontsLoaded) return null;
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>

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
          options={{ title: 'BeautySlot', headerBackVisible: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="professional/index"
          options={{ title: 'BeautySlot', headerBackVisible: false, gestureEnabled: false }}
        />
        <Stack.Screen name="professional/add-service" options={{ title: 'Add service' }} />
        <Stack.Screen name="professional/service/[id]" options={{ title: 'Edit service' }} />
        <Stack.Screen name="customer/professional/[id]" options={{ title: 'Profile' }} />
        <Stack.Screen name="professional/hours" options={{ title: 'Working hours' }} />
        <Stack.Screen name="customer/book/[serviceId]" options={{ title: 'Book' }} />
        <Stack.Screen name="customer/bookings" options={{ title: 'My bookings' }} />
        <Stack.Screen name="professional/bookings" options={{ title: 'Bookings' }} />
        <Stack.Screen name="chat/[conversationId]" options={{ title: 'Chat' }} />
        <Stack.Screen name="messages" options={{ title: 'Messages' }} />
        <Stack.Screen name="professional/home-visits" options={{ title: 'Home visits' }} />
        <Stack.Screen name="professional/reschedule/[bookingId]" options={{ title: 'Suggest a new time' }} />
        <Stack.Screen name="professional/profile" options={{ title: 'My profile' }} />
      </Stack>
    </ThemeProvider>
  );
}