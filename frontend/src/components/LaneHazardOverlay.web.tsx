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
  const biteY = useSharedValue(0);
  const gatorScale = useSharedValue(0.86);
  const gatorRotate = useSharedValue(4);
  const gatorOpacity = useSharedValue(1);
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
    biteY.value = withSequence(
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
      biteY.value = 0;
      gatorScale.value = 0.86;
      gatorRotate.value = 4;
      gatorOpacity.value = 1;
      eyeBlink.value = withSequence(
        withTiming(1, { duration: 160 }),
        withTiming(0.12, { duration: 75 }),
        withTiming(1, { duration: 105 }),
        withTiming(1, { duration: 270 }),
        withTiming(0.12, { duration: 70 }),
        withTiming(1, { duration: 100 }),
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
      { translateY: biteY.value },
      { scale: gatorScale.value },
      { rotate: `${gatorRotate.value}deg` },
    ],
  }));
  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: eyeBlink.value }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: impactFlash.value }));

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.impactFlash, flashStyle]} />

      {warning && (
        <View style={styles.waterWarning}>
          <View style={styles.waterWake} />
          <Animated.View style={[styles.eyeCrop, eyeStyle]}>
            <Image
              source={require("@/assets/images/alley-gator-2d.png")}
              resizeMode="contain"
              style={styles.eyeArt}
            />
          </Animated.View>
          <View style={styles.waterLine} />
        </View>
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
    position: "absolute", top: "48%", alignSelf: "center", width: 135, height: 54,
    alignItems: "center", justifyContent: "flex-end", zIndex: 9999,
  },
  waterWake: {
    position: "absolute", bottom: 0, width: 132, height: 22, borderRadius: 70,
    backgroundColor: "rgba(2,18,24,0.78)", borderWidth: 1, borderColor: "rgba(75,174,180,0.58)",
  },
  eyeCrop: {
    position: "absolute", bottom: 11, width: 96, height: 37, overflow: "hidden",
    transformOrigin: "center bottom",
  },
  eyeArt: { position: "absolute", width: 180, height: 191, left: 0, top: -22 },
  waterLine: {
    position: "absolute", bottom: 9, width: 116, height: 8, borderRadius: 30,
    backgroundColor: "rgba(11,48,54,0.9)", borderTopWidth: 1, borderTopColor: "rgba(122,216,216,0.72)",
  },
  gatorWrap: { position: "absolute", bottom: "43%", alignSelf: "center", width: 185, alignItems: "center", zIndex: 9999 },
  gatorArt: { width: 175, height: 143 },
  gatorArtChomp: { width: 192, height: 156, transform: [{ rotate: "-4deg" }] },
  gatorGotIt: { color: "#ffd34d", fontWeight: "900", fontSize: 10, marginTop: -15, textAlign: "center", textShadowColor: "#000", textShadowRadius: 5 },
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
