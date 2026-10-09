import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const DURATION = 1300;

const backgroundFade = new Keyframe({
  0: { opacity: 1 },
  60: { opacity: 1 },
  100: { opacity: 0, easing: Easing.out(Easing.cubic) },
});

const logoSettle = new Keyframe({
  0: { transform: [{ scale: 1 }] },
  60: { transform: [{ scale: 1 }] },
  100: { transform: [{ scale: 0.9 }], easing: Easing.out(Easing.cubic) },
});

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