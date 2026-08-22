import React, { useEffect, useState } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  interpolate,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { PINS } from "@/src/game/engine";
import { PowerUpId } from "@/src/game/powerups";

export interface ThrowState {
  key: number;
  aim: number; // -1..1
  powerup: PowerUpId | null;
}

interface Props {
  standing: number[];
  throwState: ThrowState | null;
  onArrive?: () => void;
}

const BALL_COLORS: Record<string, [string, string]> = {
  magnet: ["#5BE584", "#1F9D4E"],
  giant: ["#FFE066", "#E0A800"],
  muscle: ["#FF6B7A", "#C81E36"],
  bomb: ["#3A3A3C", "#0A0A0A"],
  lightning: ["#FFF06A", "#E0B400"],
  none: ["#FF7A45", "#D81E5B"],
};

function Pin({
  up,
  cx,
  cy,
  scale,
}: {
  up: boolean;
  cx: number;
  cy: number;
  scale: number;
}) {
  const fall = useSharedValue(up ? 0 : 1);
  useEffect(() => {
    fall.value = withTiming(up ? 0 : 1, {
      duration: up ? 100 : 430,
      easing: Easing.out(Easing.quad),
    });
  }, [up]);

  const w = 26 * scale;
  const h = 58 * scale;

  const style = useAnimatedStyle(() => ({
    opacity: 1 - fall.value * 0.9,
    transform: [
      { translateX: fall.value * (cx > 0 ? 30 : -30) * scale },
      { translateY: fall.value * 30 * scale },
      { rotate: `${fall.value * 78 * (cx > 0 ? 1 : -1)}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.pinWrap,
        { left: cx - w / 2, top: cy - h, width: w, height: h },
        style,
      ]}
    >
      {/* pin body */}
      <View style={styles.pinBody}>
        <View style={[styles.pinStripe, { top: h * 0.24 }]} />
        <View style={[styles.pinStripe, { top: h * 0.36 }]} />
      </View>
      {/* neck taper (head) */}
      <View style={[styles.pinHead, { width: w * 0.62, height: h * 0.34, left: w * 0.19 }]} />
    </Animated.View>
  );
}

export default function BowlingLane({ standing, throwState, onArrive }: Props) {
  const [dim, setDim] = useState({ w: 0, h: 0 });
  const prog = useSharedValue(0);
  const flash = useSharedValue(0);
  const [effect, setEffect] = useState<PowerUpId | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setDim({ w: width, h: height });
  };

  const { w, h } = dim;
  const centerX = w / 2;
  const pinDeckY = h * 0.34;
  const nearY = h;
  const nearHalf = w * 0.46;
  const farHalf = w * 0.17;
  const gutter = w * 0.05;

  const project = (x: number, t: number) => {
    const y = nearY + t * (pinDeckY - nearY);
    const half = nearHalf + t * (farHalf - nearHalf);
    const sx = centerX + x * half;
    const scale = 1 - t * 0.76;
    return { x: sx, y, scale };
  };

  // pin depth: back rows further (larger t)
  const pinT = (row: number) => 0.8 + row * 0.05;
  const PIN_X = 0.42;

  const aim = throwState?.aim ?? 0;
  const isGiant = throwState?.powerup === "giant";
  const isMagnet = throwState?.powerup === "magnet";

  const startP = project(0, 0.03);
  const endP = project(aim * 0.42, 0.8);
  const baseBall = w * 0.16;

  useEffect(() => {
    if (!throwState || w === 0) return;
    setEffect(throwState.powerup);
    prog.value = 0;
    prog.value = withTiming(
      1,
      { duration: 820, easing: Easing.in(Easing.quad) },
      (finished) => {
        if (finished && onArrive) runOnJS(onArrive)();
      },
    );
    if (throwState.powerup === "lightning" || throwState.powerup === "bomb") {
      flash.value = withSequence(
        withTiming(0, { duration: 660 }),
        withTiming(1, { duration: 90 }),
        withTiming(0, { duration: 440 }),
      );
    }
  }, [throwState?.key]);

  const ballStyle = useAnimatedStyle(() => {
    const p = prog.value;
    const curve = isMagnet ? Math.sin(p * Math.PI) * nearHalf * 0.35 : 0;
    const tx = interpolate(p, [0, 1], [startP.x, endP.x]) - curve;
    const ty = interpolate(p, [0, 1], [startP.y, endP.y]);
    const sc =
      interpolate(p, [0, 1], [startP.scale, endP.scale]) * (isGiant ? 1.7 : 1);
    const size = baseBall * sc;
    const opacity = interpolate(p, [0, 0.85, 1], [1, 1, 0]);
    return {
      opacity,
      width: size,
      height: size,
      borderRadius: size / 2,
      transform: [{ translateX: tx - size / 2 }, { translateY: ty - size / 2 }],
    };
  });

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const explosionStyle = useAnimatedStyle(() => ({
    opacity: flash.value,
    transform: [{ scale: 0.3 + flash.value * 1.8 }],
  }));

  const ballGrad = BALL_COLORS[throwState?.powerup ?? "none"];

  // trapezoid helper values
  const gutterTop = pinDeckY;
  const laneH = nearY - pinDeckY;
  const woodSide = nearHalf - farHalf;
  const bedSide = nearHalf + gutter - (farHalf + gutter * 0.5);

  const arrows = [-0.55, -0.2, 0.2, 0.55];

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* dark alley background */}
      <LinearGradient colors={["#0b0b0f", "#17171c", "#0b0b0f"]} style={StyleSheet.absoluteFill} />
      {/* back wall + pin pit */}
      {w > 0 && (
        <>
          <LinearGradient
            colors={["#1c1c24", "#101016"]}
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: pinDeckY + 6 }}
          />
          <View
            style={{
              position: "absolute",
              top: h * 0.2,
              left: w * 0.12,
              right: w * 0.12,
              height: 2,
              backgroundColor: "rgba(255,204,0,0.35)",
              borderRadius: 2,
            }}
          />
          <View
            style={{
              position: "absolute",
              top: pinDeckY - h * 0.11,
              left: centerX - farHalf - 8,
              width: farHalf * 2 + 16,
              height: h * 0.12,
              backgroundColor: "#040405",
              borderTopLeftRadius: 10,
              borderTopRightRadius: 10,
            }}
          />
          <LinearGradient
            colors={["rgba(255,230,170,0.14)", "transparent"]}
            style={{
              position: "absolute",
              top: pinDeckY - h * 0.06,
              left: centerX - farHalf - 20,
              width: farHalf * 2 + 40,
              height: h * 0.14,
            }}
            pointerEvents="none"
          />
        </>
      )}

      {w > 0 && (
        <>
          {/* gutter bed (dark, slightly wider) */}
          <View
            style={{
              position: "absolute",
              top: gutterTop,
              left: centerX - (farHalf + gutter * 0.5) - bedSide,
              width: (farHalf + gutter * 0.5) * 2,
              height: 0,
              borderBottomWidth: laneH,
              borderBottomColor: "#050506",
              borderLeftWidth: bedSide,
              borderRightWidth: bedSide,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
            }}
          />

          {/* wood lane trapezoid */}
          <View
            style={{
              position: "absolute",
              top: gutterTop,
              left: centerX - farHalf - woodSide,
              width: farHalf * 2,
              height: 0,
              borderBottomWidth: laneH,
              borderBottomColor: "#D9B57A",
              borderLeftWidth: woodSide,
              borderRightWidth: woodSide,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
            }}
          />
          {/* wood shading + sheen overlay (rectangle, corners fade into dark) */}
          <LinearGradient
            colors={[
              "rgba(20,12,4,0.6)",
              "rgba(120,90,50,0.15)",
              "rgba(255,240,220,0.0)",
              "rgba(255,250,240,0.22)",
            ]}
            locations={[0, 0.35, 0.7, 1]}
            style={{
              position: "absolute",
              top: pinDeckY,
              left: centerX - nearHalf,
              width: nearHalf * 2,
              height: laneH,
            }}
            pointerEvents="none"
          />
          {/* wood plank lines */}
          {[0.5].map((_, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                top: pinDeckY,
                bottom: 0,
                left: centerX - 0.5,
                width: 1,
                backgroundColor: "rgba(120,80,40,0.12)",
              }}
            />
          ))}

          {/* aiming arrows */}
          {arrows.map((ax, i) => {
            const pp = project(ax, 0.42);
            const s = pp.scale;
            return (
              <View
                key={i}
                style={{
                  position: "absolute",
                  left: pp.x - 6 * s,
                  top: pp.y,
                  width: 0,
                  height: 0,
                  borderLeftWidth: 6 * s,
                  borderRightWidth: 6 * s,
                  borderBottomWidth: 14 * s,
                  borderLeftColor: "transparent",
                  borderRightColor: "transparent",
                  borderBottomColor: "rgba(210,120,40,0.55)",
                }}
              />
            );
          })}

          {/* Pins */}
          {Object.entries(PINS).map(([idStr, p]) => {
            const id = Number(idStr);
            const pp = project(p.x * PIN_X, pinT(p.row));
            return (
              <Pin key={id} up={standing.includes(id)} cx={pp.x} cy={pp.y} scale={pp.scale} />
            );
          })}

          {/* explosion / laser burst */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.explosion,
              {
                left: endP.x - 55,
                top: endP.y - 70,
                backgroundColor:
                  effect === "bomb" ? "rgba(255,90,40,0.6)" : "rgba(255,220,60,0.7)",
              },
              explosionStyle,
            ]}
          />

          {/* ball */}
          {throwState && (
            <Animated.View style={[styles.ball, ballStyle]}>
              <LinearGradient
                colors={ballGrad}
                start={{ x: 0.3, y: 0.1 }}
                end={{ x: 0.7, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.ballShine} />
            </Animated.View>
          )}

          {/* lightning flash */}
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: "#FFF06A" }, flashStyle]}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden", backgroundColor: "#0b0b0f" },
  pinWrap: { position: "absolute", alignItems: "center", justifyContent: "flex-end" },
  pinBody: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 40,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E2E2",
    overflow: "hidden",
  },
  pinStripe: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: "#E8203A",
  },
  pinHead: {
    position: "absolute",
    top: -2,
    backgroundColor: "#FFFFFF",
    borderRadius: 40,
  },
  ball: {
    position: "absolute",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  ballShine: {
    position: "absolute",
    top: "16%",
    left: "20%",
    width: "26%",
    height: "26%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  explosion: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
  },
});
