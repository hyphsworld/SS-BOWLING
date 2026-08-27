import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from "react-native-reanimated";
import { font } from "@/src/theme/theme";

interface Props {
  text: string; // STRIKE / SPARE / GUTTER
}

// stars burst outward from the center
const STARS = [
  { angle: -90, dist: 120, size: 30, delay: 40, color: "#BEE7FF" },
  { angle: -35, dist: 150, size: 26, delay: 90, color: "#FFFFFF" },
  { angle: 30, dist: 140, size: 32, delay: 60, color: "#BEE7FF" },
  { angle: 90, dist: 110, size: 24, delay: 120, color: "#FFFFFF" },
  { angle: 150, dist: 150, size: 28, delay: 80, color: "#BEE7FF" },
  { angle: -150, dist: 135, size: 22, delay: 110, color: "#FFFFFF" },
  { angle: 5, dist: 175, size: 20, delay: 150, color: "#BEE7FF" },
  { angle: 180, dist: 90, size: 18, delay: 100, color: "#FFFFFF" },
];

function Star({ angle, dist, size, delay, color }: (typeof STARS)[number]) {
  const p = useSharedValue(0);
  React.useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }));
  }, []);
  const rad = (angle * Math.PI) / 180;
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.15 ? p.value / 0.15 : 1 - (p.value - 0.15) / 0.85,
    transform: [
      { translateX: Math.cos(rad) * dist * p.value },
      { translateY: Math.sin(rad) * dist * p.value },
      { scale: 0.4 + p.value * 0.9 },
      { rotate: `${p.value * 220}deg` },
    ],
  }));
  return (
    <Animated.View style={[styles.star, style]} pointerEvents="none">
      <Ionicons name="star" size={size} color={color} />
    </Animated.View>
  );
}

export default function Celebration({ text }: Props) {
  const isStrike = text === "STRIKE";
  const isSpare = text === "SPARE";
  const fill = isStrike ? "#FF8A00" : isSpare ? "#34C759" : "#8A8A8E";

  const pop = useSharedValue(0);
  const ring = useSharedValue(0);
  React.useEffect(() => {
    pop.value = withSequence(
      withSpring(1.15, { damping: 6, stiffness: 180 }),
      withSpring(1, { damping: 9 }),
    );
    if (isStrike || isSpare) {
      ring.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
    }
  }, []);

  const textStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }, { rotate: `${(1 - pop.value) * -8}deg` }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - ring.value) * 0.6,
    transform: [{ scale: 0.2 + ring.value * 2.4 }],
  }));

  return (
    <Animated.View style={styles.wrap} pointerEvents="none" exiting={FadeOut.duration(220)}>
      <View style={styles.inner}>
        {(isStrike || isSpare) && (
          <Animated.View
            style={[styles.ring, { borderColor: fill }, ringStyle]}
            pointerEvents="none"
          />
        )}
        {(isStrike || isSpare) && STARS.map((st, i) => <Star key={i} {...st} />)}
        <Animated.View style={textStyle}>
          <View>
            <Text style={styles.textOutline}>{text}</Text>
            <Text style={[styles.text, { color: fill }]}>{text}</Text>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: "40%", left: 0, right: 0, alignItems: "center" },
  inner: { width: 340, height: 150, alignItems: "center", justifyContent: "center" },
  star: { position: "absolute" },
  ring: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 5,
  },
  text: { fontFamily: font.display, fontSize: 72, letterSpacing: 1 },
  textOutline: {
    position: "absolute",
    fontFamily: font.display,
    fontSize: 72,
    letterSpacing: 1,
    color: "#FFFFFF",
    textShadowColor: "#1A1A1A",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    transform: [{ scale: 1.08 }],
  },
});
