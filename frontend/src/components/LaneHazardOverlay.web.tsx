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
  const [chomp, setChomp] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const activeRef = useRef(false);
  const gatorX = useSharedValue(150);
  const gatorY = useSharedValue(12);
  const gatorScale = useSharedValue(0.86);
  const gatorRotate = useSharedValue(4);
  const gatorOpacity = useSharedValue(1);
  const warningPulse = useSharedValue(0.55);
  const impactFlash = useSharedValue(0);

  const clearCycle = () => {
    cleanupRef.current.forEach(clearTimeout);
    cleanupRef.current = [];
  };

  const biteBurst = () => {
    setChomp(true);
    impactFlash.value = withSequence(
      withTiming(1, { duration: 45 }),
      withTiming(0, { duration: 150 }),
    );
    gatorScale.value = withSequence(
      withTiming(1.28, { duration: 70, easing: Easing.out(Easing.quad) }),
      withTiming(0.93, { duration: 75 }),
      withTiming(1.08, { duration: 80 }),
      withTiming(1, { duration: 90 }),
    );
    gatorY.value = withSequence(
      withTiming(-18, { duration: 65 }),
      withTiming(8, { duration: 70 }),
      withTiming(-5, { duration: 65 }),
      withTiming(0, { duration: 90 }),
    );
    gatorRotate.value = withSequence(
      withTiming(-13, { duration: 55 }),
      withTiming(14, { duration: 55 }),
      withTiming(-8, { duration: 55 }),
      withTiming(0, { duration: 75 }),
    );
    cleanupRef.current.push(setTimeout(() => setChomp(false), 260));
  };

  const schedule = () => {
    const wait = 12000 + Math.floor(Math.random() * 7000);
    timerRef.current = setTimeout(() => {
      setVisible(true);
      setWarning(true);
      setImpactText("GATOR GOT IT!");
      setChomp(false);
      activeRef.current = false;
      setWebHazardActive("alley-gator", false);
      gatorX.value = 150;
      gatorY.value = 12;
      gatorScale.value = 0.86;
      gatorRotate.value = 4;
      gatorOpacity.value = 1;
      warningPulse.value = withSequence(
        withTiming(1, { duration: 140 }),
        withTiming(0.5, { duration: 140 }),
        withTiming(1, { duration: 140 }),
        withTiming(0.5, { duration: 140 }),
        withTiming(1, { duration: 140 }),
      );

      cleanupRef.current.push(setTimeout(() => {
        setWarning(false);
        activeRef.current = true;
        setWebHazardActive("alley-gator", true);
        gatorX.value = 150;
        gatorY.value = 10;
        gatorScale.value = 0.86;
        gatorX.value = withSequence(
          withTiming(-10, { duration: 240, easing: Easing.out(Easing.back(1.7)) }),
          withTiming(12, { duration: 85 }),
          withTiming(-6, { duration: 80 }),
          withTiming(4, { duration: 70 }),
          withTiming(0, { duration: 70 }),
          withTiming(0, { duration: 430 }),
          withTiming(150, { duration: 330, easing: Easing.in(Easing.quad) }),
        );
        gatorY.value = withSequence(
          withTiming(-10, { duration: 180, easing: Easing.out(Easing.quad) }),
          withTiming(3, { duration: 80 }),
          withTiming(0, { duration: 120 }),
        );
        gatorScale.value = withSequence(
          withTiming(1.1, { duration: 180, easing: Easing.out(Easing.back(1.4)) }),
          withTiming(1, { duration: 130 }),
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
        setImpactText("BOOM! GATOR BLASTED");
        impactFlash.value = withSequence(withTiming(1, { duration: 40 }), withTiming(0, { duration: 180 }));
        gatorScale.value = withSequence(
          withTiming(1.42, { duration: 75 }),
          withTiming(0.62, { duration: 130 }),
        );
        gatorY.value = withTiming(-36, { duration: 170, easing: Easing.out(Easing.quad) });
        gatorRotate.value = withSequence(
          withTiming(-18, { duration: 55 }),
          withTiming(24, { duration: 60 }),
          withTiming(-32, { duration: 90 }),
        );
        gatorOpacity.value = withTiming(0, { duration: 300 });
        cleanupRef.current.push(setTimeout(() => {
          setVisible(false);
          schedule();
        }, 340));
      } else if (detail.powerup === "lightning") {
        setImpactText("ZAP! LIGHTNING GOT THROUGH!");
        impactFlash.value = withSequence(
          withTiming(1, { duration: 45 }),
          withTiming(0, { duration: 70 }),
          withTiming(1, { duration: 45 }),
          withTiming(0, { duration: 100 }),
        );
        gatorScale.value = withSequence(
          withTiming(1.16, { duration: 65 }),
          withTiming(0.94, { duration: 70 }),
          withTiming(1, { duration: 100 }),
        );
        gatorRotate.value = withSequence(
          withTiming(-8, { duration: 50 }),
          withTiming(8, { duration: 50 }),
          withTiming(0, { duration: 70 }),
        );
      } else {
        setImpactText("CHOMP! GATOR GOT IT!");
        biteBurst();
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
      { translateY: gatorY.value },
      { scale: gatorScale.value },
      { rotate: `${gatorRotate.value}deg` },
    ],
  }));
  const warningStyle = useAnimatedStyle(() => ({ opacity: warningPulse.value }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: impactFlash.value }));

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.impactFlash, flashStyle]} />

      {warning && (
        <Animated.View style={[styles.warning, warningStyle]}>
          <Text style={styles.warningTop}>⚠ LANE INTERFERENCE ⚠</Text>
          <Text style={styles.warningMain}>ALLEY-GATOR!</Text>
          <Text style={styles.warningSub}>WATCH THE BITE ZONE</Text>
        </Animated.View>
      )}

      {!warning && (
        <Animated.View style={[styles.gatorWrap, gatorStyle]}>
          <View style={[styles.gatorHead, chomp && styles.gatorHeadChomp]}>
            <Text style={styles.gatorEyes}>{chomp ? "😠" : "👀"}</Text>
            <Text style={[styles.gatorEmoji, chomp && styles.gatorEmojiChomp]}>🐊</Text>
            <Text style={styles.gatorLabel}>ALLEY-GATOR</Text>
            <Text style={styles.gatorGotIt}>{impactText}</Text>
            {chomp && <Text style={styles.chompBurst}>CHOMP!</Text>}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  impactFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(124,255,73,0.22)",
  },
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
  gatorWrap: { position: "absolute", right: 8, bottom: "29%", width: 170 },
  gatorHead: {
    backgroundColor: "#194d2b",
    borderWidth: 3,
    borderColor: "#7CFF49",
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
    shadowColor: "#7CFF49",
    shadowOpacity: 0.8,
    shadowRadius: 16,
  },
  gatorHeadChomp: {
    borderWidth: 5,
    shadowOpacity: 1,
    shadowRadius: 24,
  },
  gatorEyes: { fontSize: 19, marginBottom: -8 },
  gatorEmoji: { fontSize: 60, lineHeight: 66 },
  gatorEmojiChomp: { fontSize: 68, lineHeight: 72 },
  gatorLabel: { color: "#dfffca", fontWeight: "900", fontSize: 13, letterSpacing: 0.8 },
  gatorGotIt: { color: "#ffd34d", fontWeight: "900", fontSize: 11, marginTop: 2, textAlign: "center" },
  chompBurst: {
    position: "absolute",
    top: -18,
    right: -14,
    color: "#fff36b",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.2,
    transform: [{ rotate: "12deg" }],
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 4,
  },
});
