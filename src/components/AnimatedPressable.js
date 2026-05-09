import { useRef } from 'react';
import { Animated, TouchableOpacity, Easing } from 'react-native';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// Emil: instant 80ms press to scale(0.96), spring back on release
export default function AnimatedPressable({ style, children, onPress, onPressIn, onPressOut, disabled, ...props }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.96,
      duration: 80,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
    onPressIn?.();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
    onPressOut?.();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={1}
      {...props}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}
