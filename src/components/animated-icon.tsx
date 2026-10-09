import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

// 1.3 seconds in total: the calendar stays still for the first 60%
// (about 0.8 seconds), then fades out over the last 40% (about 0.5 seconds).
const DURATION = 1300;

// The black background stays, then fades away to show the app
const backgroundFade = new Keyframe({
  0: { opacity: 1 },
  60: { opacity: 1 },
  100: { opacity: 0, easing: Easing.out(Easing.cubic) },
});

// The calendar stays still, then shrinks slightly as it fades,
// like it's settling into the app
const logoSettle = new Keyframe({
  0: { transform: [{ scale: 1 }] },
  60: { transform: [{ scale: 1 }] },
  100: { transform: [{ scale: 0.9 }], easing: Easing.out(Easing.cubic) },
});

// Starts as an exact copy of the phone's own splash screen (black, calendar
// in the middle), so there's no jump when it takes over. Then it fades out.
export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const logo = <Image style={styles.logo} source={require('@/assets/images/splash-icon.png')} />;

  return animate ? (
    <Animated.View
      entering={backgroundFade.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.overlay}
    >
      <Animated.View entering={logoSettle.duration(DURATION)}>{logo}</Animated.View>
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          setAnimate(true);
        });
      }}
      style={styles.overlay}
    >
      {logo}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  logo: {
    width: 110,
    height: 110,
  },
});