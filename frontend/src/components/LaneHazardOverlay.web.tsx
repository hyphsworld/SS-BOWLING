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

type GatorSide = "left" | "right";
type WarningZone = "wallHigh" | "wallLow" | "lane";

const WARNING_SPOTS: WarningZone[] = ["wallHigh", "wallLow", "lane"];

export default function LaneHazardOverlay() {
  const [visible, setVisible] = useState(false);
  const [warning, setWarning] = useState(false);
  const [impactText, setImpactText] = useState("GATOR GOT IT!");
  const [chomp, setChomp] = useState(false);
  const [showGator, setShowGator] = useState(false);
  const [gatorSide, setGatorSide] = useState<GatorSide>("right");
  const [warningZone, setWarningZone] = useState<WarningZone>("wallHigh");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const activeRef = useRef(false);
  const cycleRef = useRef(0);
  const gatorSideRef = useRef<GatorSide>("right");
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

  const stageGatorAttack = () => {
    const side = gatorSideRef.current;
    const entryOffset = side === "right" ? 210 : -210;
    const overshoot = side === "right" ? -12 : 12;
    const rebound = side === "right" ? 4 : -4;
    setWarning(false);
    setShowGator(true);
    setChomp(false);
    gatorX.value = entryOffset;
    gatorY.value = 0;
    biteY.value = 0;
    gatorScale.value = 0.72;
    gatorRotate.value = 4;
    gatorOpacity.value = 1;
    gatorX.value = withSequence(
      withTiming(overshoot, { duration: 160, easing: Easing.out(Easing.back(1.7)) }),
      withTiming(rebound, { duration: 70 }),
      withTiming(0, { duration: 50 }),
      withTiming(0, { duration: 330 }),
      withTiming(entryOffset, { duration: 220, easing: Easing.in(Easing.quad) }),
    );
    gatorScale.value = withSequence(
      withTiming(1.1, { duration: 145, easing: Easing.out(Easing.back(1.4)) }),
      withTiming(1, { duration: 105 }),
    );
  };

  const schedule = (first = false) => {
    const wait = first ? 1600 : 6500 + Math.floor(Math.random() * 3500);
    timerRef.current = setTimeout(() => {
      const nextSide: GatorSide = Math.random() < 0.5 ? "left" : "right";
      const firstSpotIndex = Math.floor(Math.random() * WARNING_SPOTS.length);
      cycleRef.current += 1;
      gatorSideRef.current = nextSide;
      setGatorSide(nextSide);
      setWarningZone(WARNING_SPOTS[firstSpotIndex]);
      setVisible(true);
      setWarning(true);
      setShowGator(false);
      setImpactText("GATOR GOT IT!");
      setChomp(false);
      activeRef.current = false;
      setWebHazardActive("alley-gator", false);
      gatorOpacity.value = 1;
      eyeBlink.value = withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(0.08, { duration: 70 }),
        withTiming(1, { duration: 100 }),
        withTiming(1, { duration: 240 }),
        withTiming(0.08, { duration: 65 }),
        withTiming(1, { duration: 95 }),
      );

      cleanupRef.current.push(setTimeout(() => {
        setWarningZone(WARNING_SPOTS[(firstSpotIndex + 1) % WARNING_SPOTS.length]);
      }, 330));
      cleanupRef.current.push(setTimeout(() => {
        setWarningZone(WARNING_SPOTS[(firstSpotIndex + 2) % WARNING_SPOTS.length]);
      }, 680));

      cleanupRef.current.push(setTimeout(() => {
        activeRef.current = true;
        setWebHazardActive("alley-gator", true);
        cleanupRef.current.push(setTimeout(() => {
          activeRef.current = false;
          setWebHazardActive("alley-gator", false);
          setWarning(false);
          setShowGator(false);
          setVisible(false);
          schedule(false);
        }, 2300));
      }, 950));
    }, wait);
  };

  useEffect(() => {
    const onImpact = (event: Event) => {
      const detail = (event as CustomEvent<HazardBridgePayload>).detail;
      if (!detail || detail.type !== "pop-wall-impact" || !activeRef.current) return;

      activeRef.current = false;
      setWebHazardActive("alley-gator", false);
      clearCycle();
      stageGatorAttack();

      if (detail.powerup === "bomb") {
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
        gatorOpacity.value = withTiming(0, { duration: 420 });
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
        cleanupRef.current.push(setTimeout(biteBurst, 90));
      }

      cleanupRef.current.push(setTimeout(() => {
        setShowGator(false);
        setVisible(false);
        schedule(false);
      }, 860));
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
        <View style={[
          styles.eyeWarning,
          gatorSide === "left" ? styles.warningLeft : styles.warningRight,
          warningZone === "wallHigh"
            ? styles.warningWallHigh
            : warningZone === "wallLow"
              ? styles.warningWallLow
              : styles.warningLane,
        ]}>
          <Animated.View style={[styles.submergedHead, eyeStyle]}>
            <View style={styles.eyesRow}>
              <View style={styles.marbleEye}><View style={styles.eyePupil} /></View>
              <View style={styles.marbleEye}><View style={styles.eyePupil} /></View>
            </View>
          </Animated.View>
        </View>
      )}

      {showGator && (
        <Animated.View style={[
          styles.gatorWrap,
          gatorSide === "left" ? styles.gatorLeft : styles.gatorRight,
          gatorStyle,
        ]}>
          <Image
            source={require("@/assets/images/alley-gator-2d.png")}
            resizeMode="contain"
            style={[
              styles.gatorArt,
              chomp
                ? (gatorSide === "left" ? styles.gatorArtChompLeft : styles.gatorArtChomp)
                : (gatorSide === "left" && styles.gatorArtLeft),
            ]}
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
  eyeWarning: {
    position: "absolute", width: 60, height: 16,
    alignItems: "center", zIndex: 9999,
  },
  warningLeft: { left: "7%" },
  warningRight: { right: "7%" },
  warningWallHigh: { top: "47%" },
  warningWallLow: { top: "55%" },
  warningLane: { top: "63%" },
  submergedHead: {
    position: "absolute", top: 2, width: 60, height: 14,
    transformOrigin: "center", alignItems: "center",
  },
  eyesRow: { position: "absolute", top: 2, width: 36, flexDirection: "row", justifyContent: "space-between" },
  marbleEye: {
    width: 8, height: 10, borderRadius: 5, backgroundColor: "#ffb21c",
    borderWidth: 0.5, borderColor: "#ffd66e", alignItems: "center", justifyContent: "center",
    shadowColor: "#ff6a00", shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  eyePupil: { width: 1.5, height: 7, borderRadius: 2, backgroundColor: "#190c06" },
  gatorWrap: { position: "absolute", bottom: "38%", width: 185, alignItems: "center", zIndex: 9999 },
  gatorLeft: { left: 8 },
  gatorRight: { right: 8 },
  gatorArt: { width: 175, height: 143 },
  gatorArtLeft: { transform: [{ scaleX: -1 }] },
  gatorArtChomp: { width: 192, height: 156, transform: [{ rotate: "-4deg" }] },
  gatorArtChompLeft: { width: 192, height: 156, transform: [{ scaleX: -1 }, { rotate: "-4deg" }] },
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
