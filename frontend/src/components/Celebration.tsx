import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  ZoomIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { colors, font } from "@/src/theme/theme";

interface Props {
  text: string; // STRIKE / SPARE / GUTTER
}

const STARS = [
  { top: -6, left: 30, size: 26, delay: 60 },
  { top: 8, left: 250, size: 30, delay: 120 },
  { top: 60, left: -6, size: 22, delay: 180 },
  { top: 66, left: 290, size: 26, delay: 90 },
  { top: 96, left: 60, size: 20, delay: 220 },
  { top: 90, left: 220, size: 24, delay: 160 },
];

function Star({ top, left, size, delay }: { top: number; left: number; size: number; delay: number }) {
  const s = useSharedValue(0);
  React.useEffect(() => {
    s.value = withDelay(
      delay,
      withSequence(
        withTiming(1.2, { duration: 220, easing: Easing.out(Easing.back(2)) }),
        withTiming(1, { duration: 120 }),
      ),
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: s.value,
    transform: [{ scale: s.value }, { rotate: `${s.value * 40}deg` }],
  }));
  return (
    <Animated.View style={[{ position: "absolute", top, left }, style]} pointerEvents="none">
      <Ionicons name="star" size={size} color="#BEE7FF" />
    </Animated.View>
  );
}

export default function Celebration({ text }: Props) {
  const isStrike = text === "STRIKE";
  const isSpare = text === "SPARE";
  const fill = isStrike ? "#FF7A00" : isSpare ? colors.brandSecondary : "#8A8A8E";

  return (
    <Animated.View
      style={styles.wrap}
      pointerEvents="none"
      entering={ZoomIn.duration(260)}
      exiting={FadeOut.duration(200)}
    >
      <View style={styles.inner}>
        {(isStrike || isSpare) &&
          STARS.map((st, i) => <Star key={i} {...st} />)}
        {/* outline layer */}
        <Text style={[styles.textOutline]}>{text}</Text>
        <Text style={[styles.text, { color: fill }]}>{text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: "42%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  inner: { width: 320, height: 130, alignItems: "center", justifyContent: "center" },
  text: {
    fontFamily: font.display,
    fontSize: 68,
    letterSpacing: 1,
  },
  textOutline: {
    position: "absolute",
    fontFamily: font.display,
    fontSize: 68,
    letterSpacing: 1,
    color: "#1A1A1A",
    textShadowColor: "#1A1A1A",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
    // fake thick outline via scale
    transform: [{ scale: 1.06 }],
  },
});
