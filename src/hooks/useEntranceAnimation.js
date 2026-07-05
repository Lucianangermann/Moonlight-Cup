import { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';
import { prefersReducedMotion } from '../utils/motion';

// Emil: start from scale(0.97) + translateY, not scale(0) — nothing appears from nothing
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export const useEntranceAnimation = (delay = 0) => {
  const reduced = prefersReducedMotion();
  const opacity    = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reduced ? 0 : 8)).current;
  const scale      = useRef(new Animated.Value(reduced ? 1 : 0.97)).current;

  useEffect(() => {
    if (reduced) return;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        delay,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 320,
        delay,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return { opacity, transform: [{ translateY }, { scale }] };
};
