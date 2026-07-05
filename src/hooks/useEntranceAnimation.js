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

// Emil: stagger 50ms between items (within the 30-80ms sweet spot)
export const useStaggerAnimation = (itemCount, baseDelay = 50) => {
  const reduced = prefersReducedMotion();
  const anims = useRef(
    Array.from({ length: itemCount }, () => ({
      opacity:    new Animated.Value(reduced ? 1 : 0),
      translateY: new Animated.Value(reduced ? 0 : 5),
    }))
  ).current;

  useEffect(() => {
    if (reduced) return;
    const animations = anims.map((anim, i) =>
      Animated.parallel([
        Animated.timing(anim.opacity, {
          toValue: 1,
          duration: 260,
          delay: i * baseDelay,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(anim.translateY, {
          toValue: 0,
          duration: 260,
          delay: i * baseDelay,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.stagger(baseDelay, animations).start();
  }, [itemCount]);

  return anims.map((anim) => ({
    opacity: anim.opacity,
    transform: [{ translateY: anim.translateY }],
  }));
};
