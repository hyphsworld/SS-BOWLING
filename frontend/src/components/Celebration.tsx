import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { font } from "@/src/theme/theme";

type EventType = "strike" | "spare" | null;

interface Props {
  event: EventType;
}

const STARS = [
  { angle: -90, dist: 132, size: 30, delay: 20, color: "#FFFFFF" },
  { angle: -35, dist: 160, size: 27, delay: 60, color: "#20F6FF" },
  { angle: 30, dist: 150, size: 32, delay: 45, color: "#39FF14" },
  { angle: 90, dist: 122, size: 25, delay: 90, color: "#FFF36A" },
  { angle: 150, dist: 158, size: 29, delay: 55, color: "#FF2DFF" },
  { angle: -150, dist: 145, size: 23, delay: 80, color: "#FFFFFF" },
  { angle: 5, dist: 182, size: 20, delay: 110, color: "#20F6FF" },
  { angle: 180, dist: 105, size: 19, delay: 70, color: "#39FF14" },
];

function Star({ angle, dist, size, delay, color }: (typeof STARS)[number]) {
  const p = useSharedValue(0);
  React.useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }));
  }, [delay, p]);

  const rad = (angle * Math.PI) / 180;
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.14 ? p.value / 0.14 : Math.max(0, 1 - (p.value - 0.14) / 0.86),
    transform: [
      { translateX: Math.cos(rad) * dist * p.value },
      { translateY: Math.sin(rad) * dist * p.value },
      { scale: 0.35 + p.value },
      { rotate: `${p.value * 240}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.star, style]} pointerEvents="none">
      <Ionicons name="star" size={size} color={color} />
    </Animated.View>
  );
}

export default function Celebration({ event }: Props) {
  const isStrike = event === "strike";
  const isSpare = event === "spare";
  const visible = isStrike || isSpare;
  const label = isStrike ? "STRIKE!" : "SPARE!";

  const pop = useSharedValue(0);
  const ring = useSharedValue(0);
  const flash = useSharedValue(0);

  React.useEffect(() => {
    if (!visible) return;

    pop.value = 0;
    ring.value = 0;
    flash.value = 0;

    pop.value = withSequence(
      withSpring(1.22, { damping: 6, stiffness: 190 }),
      withSpring(1, { damping: 10, stiffness: 150 }),
    );
    ring.value = withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) });
    flash.value = withSequence(
      withTiming(1, { duration: 110 }),
      withDelay(120, withTiming(0, { duration: 480 })),
    );

    const haptic = isStrike
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    haptic.catch(() => {});
  }, [visible, isStrike, pop, ring, flash]);

  const textStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }, { rotate: `${(1 - pop.value) * -7}deg` }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - ring.value) * 0.85,
    transform: [{ scale: 0.18 + ring.value * 2.9 }],
  }));

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value * 0.55 }));

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(90)}
      exiting={FadeOut.duration(220)}
      style={styles.wrap}
      pointerEvents="none"
    >
      <Animated.View style={[styles.flash, flashStyle]} />
      <View style={styles.inner}>
        <Animated.View style={[styles.ringOuter, ringStyle]} pointerEvents="none" />
        <Animated.View style={[styles.ringInner, ringStyle]} pointerEvents="none" />
        {STARS.map((st, i) => <Star key={`${event}-${i}`} {...st} />)}
        <Animated.View style={textStyle}>
          <View>
            <Text style={styles.textOutline}>{label}</Text>
            <Text style={[styles.text, isSpare && styles.spareText]}>{label}</Text>
            {isStrike && <Text style={styles.sub}>SUPER STRIKE</Text>}
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#20F6FF",
  },
  inner: {
    width: 390,
    maxWidth: "96%",
    height: 230,
    alignItems: "center",
    justifyContent: "center",
  },
  star: { position: "absolute" },
  ringOuter: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 6,
    borderColor: "#20F6FF",
  },
  ringInner: {
    position: "absolute",
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 4,
    borderColor: "#FF2DFF",
  },
  text: {
    fontFamily: font.display,
    fontSize: 82,
    lineHeight: 86,
    letterSpacing: 1,
    color: "#FFF36A",
    textShadowColor: "#FF2DFF",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  spareText: {
    color: "#39FF14",
    textShadowColor: "#20F6FF",
  },
  textOutline: {
    position: "absolute",
    fontFamily: font.display,
    fontSize: 82,
    lineHeight: 86,
    letterSpacing: 1,
    color: "#FFFFFF",
    textShadowColor: "#050507",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
    transform: [{ scale: 1.07 }],
  },
  sub: {
    marginTop: -2,
    textAlign: "center",
    color: "#FFFFFF",
    fontFamily: font.heavy,
    fontSize: 14,
    letterSpacing: 5,
    textShadowColor: "#20F6FF",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
});
