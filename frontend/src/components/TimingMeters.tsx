import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, font, radius, spacing, type } from "@/src/theme/theme";
import { POCKET_X, AIM_SCALE } from "@/src/game/engine";
import { playSound } from "@/src/audio/sounds";

type Phase = "aim" | "power" | "idle";

interface Props {
  phase: Phase;
  onLockAim: (aim: number) => void; // -1..1
  onLockPower: (power: number) => void; // 0..1
}

const POCKET_VALUE = (POCKET_X / AIM_SCALE + 1) / 2; // ~0.59

export default function TimingMeters({ phase, onLockAim, onLockPower }: Props) {
  const sweep = useSharedValue(0);
  const trackW = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(sweep);
    sweep.value = 0;
    if (phase === "aim" || phase === "power") {
      const dur = phase === "aim" ? 1400 : 850;
      sweep.value = withRepeat(
        withTiming(1, { duration: dur, easing: Easing.linear }),
        -1,
        true,
      );
    }
  }, [phase]);

  const markerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value * trackW.value }],
  }));

  const handleLock = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    playSound("lock");
    const v = sweep.value;
    if (phase === "aim") onLockAim(v * 2 - 1);
    else onLockPower(v);
  };

  const isAim = phase === "aim";
  const accent = isAim ? colors.brandSecondary : colors.brandPrimary;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {isAim ? "TAP TO SET YOUR AIM" : "TAP TO SET POWER"}
      </Text>
      <View
        style={styles.track}
        onLayout={(e) => {
          trackW.value = e.nativeEvent.layout.width - 8;
        }}
      >
        {isAim ? (
          <View
            style={[
              styles.zone,
              {
                left: `${(POCKET_VALUE - 0.05) * 100}%`,
                width: "10%",
                backgroundColor: colors.brandSecondary,
              },
            ]}
          />
        ) : (
          <View
            style={[
              styles.zone,
              { left: "60%", width: "30%", backgroundColor: colors.brand },
            ]}
          />
        )}
        <Animated.View style={[styles.marker, { backgroundColor: accent }, markerStyle]} />
      </View>
      <Pressable
        testID={isAim ? "lock-aim-button" : "throw-button"}
        onPress={handleLock}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: accent },
          pressed && { transform: [{ scale: 0.97 }] },
        ]}
      >
        <Text style={[styles.btnText, { color: isAim ? colors.onSurface : colors.onSurfaceInverse }]}>
          {isAim ? "LOCK AIM" : "THROW!"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, alignItems: "stretch" },
  label: {
    fontFamily: font.display,
    fontSize: type.base,
    color: "#EAF7FF",
    textAlign: "center",
  },
  track: {
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: "rgba(2,8,24,0.85)",
    borderWidth: 2,
    borderColor: "rgba(34,225,255,0.5)",
    justifyContent: "center",
    overflow: "hidden",
  },
  zone: {
    position: "absolute",
    top: 0,
    bottom: 0,
    opacity: 0.55,
  },
  marker: {
    position: "absolute",
    left: 2,
    width: 8,
    top: 2,
    bottom: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#EAF7FF",
  },
  btn: {
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
  },
  btnText: { fontFamily: font.display, fontSize: type.xl },
});
