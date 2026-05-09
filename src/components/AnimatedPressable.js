import { useRef } from 'react';
import { Animated, TouchableOpacity, Easing, Platform } from 'react-native';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// Press: instant 80ms to scale(0.96). Hover (web only): 150ms to scale(1.04).
// Spring back on release. activeOpacity is absorbed so it can't override the internal 1.
export default function AnimatedPressable({
  style,
  children,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  activeOpacity, // intentionally ignored — we control opacity via scale only
  ...props
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const hovering = useRef(false);

  const animateTo = (toValue, duration) => {
    Animated.timing(scale, {
      toValue,
      duration,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
  };

  const handlePressIn = () => {
    animateTo(0.96, 80);
    onPressIn?.();
  };

  const handlePressOut = () => {
    // Spring back to hover scale if cursor is still over the element
    Animated.spring(scale, {
      toValue: hovering.current ? 1.04 : 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
    onPressOut?.();
  };

  const hoverProps = Platform.OS === 'web' ? {
    onMouseEnter: () => {
      hovering.current = true;
      animateTo(1.04, 150);
    },
    onMouseLeave: () => {
      hovering.current = false;
      animateTo(1, 180);
    },
  } : {};

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={1}
      {...hoverProps}
      {...props}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}
