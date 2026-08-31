import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { setWebHazardActive } from "@/src/game/hazards";
import type { PowerUpId } from "@/src/game/powerups";

type HazardBridgePayload = {
  type: "pop-wall-impact";
  powerup: PowerUpId | null;
  ballX: number;
};

export default function LaneHazardOverlay() {
  const [visible, setVisible] = useState(false);
  const [warning, setWarning] = useState(false);
  const [impactText, setImpactText] = useState("GATOR GOT IT!");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const activeRef = useRef(false);
  const gatorX = useSharedValue(130);
  const gatorScale = useSharedValue(1);
  const gatorRotate = useSharedValue(0);
  const gatorOpacity = useSharedValue(1);
  const warningPulse = useSharedValue(0.55);

  const clearCycle = () => {
    cleanupRef.current.forEach(clearTimeout);
    cleanupRef.current = [];
  };

  const schedule = () => {
    const wait = 12000 + Math.floor(Math.random() * 7000);
    timerRef.current = setTimeout(() => {
      setVisible(true);
      setWarning(true);
      setImpactText("GATOR GOT IT!");
      activeRef.current = false;
      setWebHazardActive("alley-gator", false);
      gatorScale.value = 1;
      gatorRotate.value = 0;
      gatorOpacity.value = 1;
      warningPulse.value = withSequence(
        withTiming(1, { duration: 160 }),
        withTiming(0.55, { duration: 160 }),
        withTiming(1, { duration: 160 }),
        withTiming(0.55, { duration: 160 }),
      );

      cleanupRef.current.push(setTimeout(() => {
        setWarning(false);
        activeRef.current = true;
        setWebHazardActive("alley-gator", true);
        gatorX.value = 130;
        gatorX.value = withSequence(
          withTiming(0, { duration: 220, easing: Easing.out(Easing.back(1.2)) }),
          withTiming(-8, { duration: 120 }),
          withTiming(12, { duration: 90 }),
          withTiming(-4, { duration: 80 }),
          withTiming(0, { duration: 80 }),
          withTiming(0, { duration: 350 }),
          withTiming(130, { duration: 360, easing: Easing.in(Easing.quad) }),
        );

        cleanupRef.current.push(setTimeout(() => {
          activeRef.current = false;
          setWebHazardActive("alley-gator", false);
          setVisible(false);
          schedule();
        }, 1300));
      }, 900));
    }, wait);
  };

  useEffect(() => {
    const onImpact = (event: Event) => {
      const detail = (event as CustomEvent<HazardBridgePayload>).detail;
      if (!detail || detail.type !== "pop-wall-impact" || !activeRef.current) return;

      if (detail.powerup === "bomb") {
        activeRef.current = false;
        setWebHazardActive("alley-gator", false);
        clearCycle();
        setImpactText("BOOM! GATOR SMASHED");
        gatorScale.value = withSequence(
          withTiming(1.25, { duration: 90 }),
          withTiming(0.78, { duration: 100 }),
        );
        gatorRotate.value = withSequence(
          withTiming(-12, { duration: 70 }),
          withTiming(16, { duration: 70 }),
          withTiming(-22, { duration: 90 }),
        );
        gatorOpacity.value = withTiming(0, { duration: 260 });
        cleanupRef.current.push(setTimeout(() => {
          setVisible(false);
          schedule();
        }, 320));
      } else if (detail.powerup === "lightning") {
        setImpactText("LIGHTNING GOT THROUGH!");
        gatorScale.value = withSequence(withTiming(1.08, { duration: 80 }), withTiming(1, { duration: 120 }));
      } else {
        setImpactText("GATOR GOT IT!");
        gatorRotate.value = withSequence(
          withTiming(-7, { duration: 55 }),
          withTiming(7, { duration: 55 }),
          withTiming(0, { duration: 70 }),
        );
      }
    };

    window.addEventListener("super-strike-hazard", onImpact as EventListener);
    schedule();
    return () => {
      window.removeEventListener("super-strike-hazard", onImpact as EventListener);
      if (timerRef.current) clearTimeout(timerRef.current);
      clearCycle();
      activeRef.current = false;
      setWebHazardActive("alley-gator", false);
    };
  }, []);

  const gatorStyle = useAnimatedStyle(() => ({
    opacity: gatorOpacity.value,
    transform: [
      { translateX: gatorX.value },
      { scale: gatorScale.value },
      { rotate: `${gatorRotate.value}deg` },
    ],
  }));
  const warningStyle = useAnimatedStyle(() => ({ opacity: warningPulse.value }));

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {warning && (
        <Animated.View style={[styles.warning, warningStyle]}>
          <Text style={styles.warningTop}>⚠ LANE INTERFERENCE ⚠</Text>
          <Text style={styles.warningMain}>ALLEY-GATOR!</Text>
          <Text style={styles.warningSub}>WATCH THE BITE ZONE</Text>
        </Animated.View>
      )}

      {!warning && (
        <Animated.View style={[styles.gatorWrap, gatorStyle]}>
          <View style={styles.gatorHead}>
            <Text style={styles.gatorEyes}>👀</Text>
            <Text style={styles.gatorEmoji}>🐊</Text>
            <Text style={styles.gatorLabel}>ALLEY-GATOR</Text>
            <Text style={styles.gatorGotIt}>{impactText}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  warning: {
    position: "absolute",
    top: "32%",
    alignSelf: "center",
    width: "84%",
    maxWidth: 420,
    backgroundColor: "rgba(12,10,8,0.92)",
    borderWidth: 2,
    borderColor: "#7CFF49",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    shadowColor: "#7CFF49",
    shadowOpacity: 0.8,
    shadowRadius: 16,
  },
  warningTop: { color: "#dfffca", fontWeight: "900", fontSize: 14, letterSpacing: 1.2 },
  warningMain: { color: "white", fontWeight: "900", fontSize: 30, marginTop: 3 },
  warningSub: { color: "#7CFF49", fontWeight: "800", fontSize: 12, marginTop: 2, letterSpacing: 0.8 },
  gatorWrap: { position: "absolute", right: 8, bottom: "29%", width: 156 },
  gatorHead: {
    backgroundColor: "#194d2b",
    borderWidth: 3,
    borderColor: "#7CFF49",
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
    shadowColor: "#7CFF49",
    shadowOpacity: 0.7,
    shadowRadius: 12,
  },
  gatorEyes: { fontSize: 17, marginBottom: -8 },
  gatorEmoji: { fontSize: 55, lineHeight: 62 },
  gatorLabel: { color: "#dfffca", fontWeight: "900", fontSize: 13, letterSpacing: 0.8 },
  gatorGotIt: { color: "#ffd34d", fontWeight: "900", fontSize: 11, marginTop: 2, textAlign: "center" },
});
