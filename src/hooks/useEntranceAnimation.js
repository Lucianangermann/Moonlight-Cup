import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

export const useEntranceAnimation = (delay = 0) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 380,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return { opacity, transform: [{ translateY }] };
};

// Staggered animation for list items
export const useStaggerAnimation = (itemCount, baseDelay = 60) => {
  const anims = useRef(
    Array.from({ length: itemCount }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(12),
    }))
  ).current;

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.parallel([
        Animated.timing(anim.opacity, {
          toValue: 1,
          duration: 300,
          delay: i * baseDelay,
          useNativeDriver: true,
        }),
        Animated.timing(anim.translateY, {
          toValue: 0,
          duration: 300,
          delay: i * baseDelay,
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
