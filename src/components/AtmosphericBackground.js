import { useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions, Animated } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Deterministic star distribution using golden-ratio spread
const buildStars = (count) => {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      id: i,
      cx: ((i * 137.508) % 100),
      cy: ((i * 73.921) % 100),
      r: 0.4 + (i % 6) * 0.22,
      baseOpacity: 0.15 + (i % 7) * 0.1,
      gold: i % 12 === 0,
      twinkle: i % 8 === 0,
    });
  }
  return stars;
};

const ALL_STARS = buildStars(110);
const STATIC_STARS = ALL_STARS.filter((s) => !s.twinkle);
const TWINKLE_STARS = ALL_STARS.filter((s) => s.twinkle);

export default function AtmosphericBackground() {
  const { width, height } = useWindowDimensions();

  const twinkleAnims = useRef(
    TWINKLE_STARS.map(() => new Animated.Value(1))
  ).current;

  useEffect(() => {
    const loops = twinkleAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 0.15,
            duration: 1800 + i * 400,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1800 + i * 400,
            useNativeDriver: false,
          }),
        ])
      )
    );
    loops.forEach((l, i) => setTimeout(() => l.start(), i * 250));
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View style={[styles.container, { width, height }]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Deep background gradient */}
          <RadialGradient id="bgGrad" cx="50%" cy="35%" r="65%">
            <Stop offset="0%" stopColor="#0D1A3A" stopOpacity="1" />
            <Stop offset="100%" stopColor="#060912" stopOpacity="1" />
          </RadialGradient>
          {/* Moon glow at top */}
          <RadialGradient id="moonGlow" cx="50%" cy="0%" r="55%">
            <Stop offset="0%" stopColor="#F0C040" stopOpacity="0.07" />
            <Stop offset="60%" stopColor="#F0C040" stopOpacity="0.01" />
            <Stop offset="100%" stopColor="#060912" stopOpacity="0" />
          </RadialGradient>
          {/* Cyan accent bottom-right */}
          <RadialGradient id="cyanGlow" cx="85%" cy="90%" r="40%">
            <Stop offset="0%" stopColor="#00D4FF" stopOpacity="0.025" />
            <Stop offset="100%" stopColor="#00D4FF" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Base background */}
        <Ellipse cx={width / 2} cy={height / 2} rx={width} ry={height} fill="url(#bgGrad)" />

        {/* Atmospheric glows */}
        <Ellipse cx={width / 2} cy={0} rx={width * 0.7} ry={height * 0.55} fill="url(#moonGlow)" />
        <Ellipse cx={width * 0.85} cy={height * 0.9} rx={width * 0.5} ry={height * 0.45} fill="url(#cyanGlow)" />

        {/* Static stars */}
        {STATIC_STARS.map((star) => (
          <Circle
            key={star.id}
            cx={(star.cx / 100) * width}
            cy={(star.cy / 100) * height}
            r={star.r}
            fill={star.gold ? '#F0C040' : '#C8D4E8'}
            opacity={star.baseOpacity}
          />
        ))}

        {/* Twinkling stars */}
        {TWINKLE_STARS.map((star, i) => (
          <AnimatedCircle
            key={star.id}
            cx={(star.cx / 100) * width}
            cy={(star.cy / 100) * height}
            r={star.r + 0.4}
            fill={star.gold ? '#F0C040' : '#C8D4E8'}
            opacity={twinkleAnims[i]}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 0,
  },
});
