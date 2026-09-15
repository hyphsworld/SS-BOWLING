import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
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
  const cycleRef = useRef(0);
  const gatorX = useSharedValue(150);
  const gatorY = useSharedValue(12);
  const gatorScale = useSharedValue(0.86);
  const gatorRotate = useSharedValue(4);
  const gatorOpacity = useSharedValue(1);
  const warningPulse = useSharedValue(0.55);
  const eyeBlink = useSharedValue(1);
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

  const schedule = (first = false) => {
    const wait = first ? 1800 : 6500 + Math.floor(Math.random() * 3500);
    timerRef.current = setTimeout(() => {
      cycleRef.current += 1;
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
      eyeBlink.value = withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(0.08, { duration: 70 }),
        withTiming(1, { duration: 90 }),
        withTiming(1, { duration: 210 }),
        withTiming(0.08, { duration: 65 }),
        withTiming(1, { duration: 95 }),
      );
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
        gatorX.value = 0;
        gatorY.value = 115;
        gatorScale.value = 0.42;
        gatorX.value = withSequence(
          withTiming(0, { duration: 240 }),
          withTiming(0, { duration: 2200 }),
          withTiming(0, { duration: 330 }),
        );
        gatorY.value = withSequence(
          withTiming(-10, { duration: 180, easing: Easing.out(Easing.back(1.7)) }),
          withTiming(3, { duration: 80 }),
          withTiming(0, { duration: 120 }),
          withTiming(0, { duration: 2200 }),
          withTiming(115, { duration: 330, easing: Easing.in(Easing.quad) }),
        );
        gatorScale.value = withSequence(
          withTiming(1.1, { duration: 180, easing: Easing.out(Easing.back(1.4)) }),
          withTiming(1, { duration: 130 }),
        );

        cleanupRef.current.push(setTimeout(() => {
          activeRef.current = false;
          setWebHazardActive("alley-gator", false);
          setVisible(false);
          schedule(false);
        }, 3200));
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
          schedule(false);
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
    schedule(true);
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
  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: eyeBlink.value }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: impactFlash.value }));

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.impactFlash, flashStyle]} />

      {warning && (
        <Animated.View style={[styles.waterWarning, warningStyle]}>
          <View style={styles.waterShadow} />
          <View style={[styles.ripple, styles.rippleWide]} />
          <View style={styles.ripple} />
          <View style={styles.eyesRow}>
            <Animated.View style={[styles.eye, styles.eyeLeft, eyeStyle]}>
              <View style={styles.pupil} />
            </Animated.View>
            <Animated.View style={[styles.eye, styles.eyeRight, eyeStyle]}>
              <View style={styles.pupil} />
            </Animated.View>
          </View>
        </Animated.View>
      )}

      {!warning && (
        <Animated.View style={[styles.gatorWrap, gatorStyle]}>
          <Image
            source={require("@/assets/images/alley-gator-2d.png")}
            resizeMode="contain"
            style={[styles.gatorArt, chomp && styles.gatorArtChomp]}
          />
          <Text style={styles.gatorGotIt}>{impactText}</Text>
          {chomp && <Text style={styles.chompBurst}>CHOMP!</Text>}
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
  waterWarning: {
    position: "absolute",
    top: "47%",
    alignSelf: "center",
    width: 190,
    height: 78,
    alignItems: "center",
    zIndex: 9999,
  },
  waterShadow: {
    position: "absolute", top: 34, width: 170, height: 30, borderRadius: 90,
    backgroundColor: "rgba(3,24,27,0.78)", borderWidth: 2, borderColor: "rgba(71,255,184,0.48)",
    shadowColor: "#22e1ff", shadowOpacity: 0.55, shadowRadius: 12,
  },
  ripple: {
    position: "absolute", top: 30, width: 145, height: 34, borderRadius: 90,
    borderWidth: 2, borderColor: "rgba(126,255,207,0.72)",
  },
  rippleWide: { top: 25, width: 190, height: 46, borderColor: "rgba(34,225,255,0.42)" },
  eyesRow: { position: "absolute", top: 14, flexDirection: "row", gap: 28 },
  eye: {
    width: 38, height: 24, borderRadius: 20, backgroundColor: "#dfff28", borderWidth: 3,
    borderColor: "#4b7d13", alignItems: "center", justifyContent: "center",
    shadowColor: "#caff00", shadowOpacity: 1, shadowRadius: 12,
  },
  eyeLeft: { transform: [{ rotate: "8deg" }] },
  eyeRight: { transform: [{ rotate: "-8deg" }] },
  pupil: { width: 5, height: 16, borderRadius: 4, backgroundColor: "#050807" },
  gatorWrap: { position: "absolute", bottom: "24%", alignSelf: "center", width: 250, alignItems: "center", zIndex: 9999 },
  gatorArt: { width: 230, height: 188 },
  gatorArtChomp: { width: 248, height: 200, transform: [{ rotate: "-4deg" }] },
  gatorGotIt: { color: "#ffd34d", fontWeight: "900", fontSize: 12, marginTop: -18, textAlign: "center", textShadowColor: "#000", textShadowRadius: 5 },
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
