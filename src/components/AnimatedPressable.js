import { useRef } from 'react';
import { Animated, TouchableOpacity, Easing, Platform, StyleSheet } from 'react-native';

const LAYOUT_KEYS = new Set([
  'flex', 'flexGrow', 'flexShrink', 'flexBasis',
  'width', 'minWidth', 'maxWidth', 'height', 'minHeight', 'maxHeight',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical',
  'alignSelf', 'position', 'top', 'left', 'right', 'bottom', 'zIndex',
]);

function splitStyle(style) {
  const flat = StyleSheet.flatten(style) ?? {};
  const outer = {};
  const inner = {};
  for (const [key, val] of Object.entries(flat)) {
    if (LAYOUT_KEYS.has(key)) outer[key] = val;
    else inner[key] = val;
  }
  return [outer, inner];
}

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
  const [outerStyle, innerStyle] = splitStyle(style);

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
      style={outerStyle}
      {...hoverProps}
      {...props}
    >
      <Animated.View style={[innerStyle, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}
