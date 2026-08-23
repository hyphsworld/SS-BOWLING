import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  Easing,
  runOnJS,
  SharedValue,
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

// Neon energy-core ball glow colors per power-up.
const BALL_COLORS: Record<string, [string, string]> = {
  magnet: ["#7CFFB2", "#00C46A"],
  giant: ["#FFE979", "#FFB300"],
  muscle: ["#FF8FA3", "#E01E5A"],
  bomb: ["#FF9A52", "#B3200F"],
  lightning: ["#B9F1FF", "#00C2FF"],
  none: ["#8FE9FF", "#0090FF"],
};
const BURST_COLORS: Record<string, string> = {
  magnet: "#39FF9A",
  giant: "#FFD24A",
  muscle: "#FF5C7A",
  bomb: "#FF7A2A",
  lightning: "#63E6FF",
  none: "#59D6FF",
};

const NEON = "#22E1FF";
const NEON_DIM = "rgba(34,225,255,0.35)";

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
      {/* neon glow halo */}
      <View
        style={[
          styles.pinGlow,
          { width: w * 1.5, height: h * 0.7, left: -w * 0.25, top: h * 0.05 },
        ]}
      />
      {/* pin body */}
      <View style={styles.pinBody}>
        <View style={[styles.pinStripe, { top: h * 0.26 }]} />
        <View style={[styles.pinStripe, styles.pinStripeThin, { top: h * 0.4 }]} />
      </View>
      {/* neck taper (head) */}
      <View style={[styles.pinHead, { width: w * 0.62, height: h * 0.34, left: w * 0.19 }]} />
    </Animated.View>
  );
}

function Particles({
  x,
  y,
  color,
  burst,
  count,
  spread,
  seed,
}: {
  x: number;
  y: number;
  color: string;
  burst: SharedValue<number>;
  count: number;
  spread: number;
  seed: number;
}) {
  const parts = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => {
        const a = (i / count) * Math.PI * 2 + (seed % 6);
        const dist = spread * (0.5 + ((i * 13 + seed) % 10) / 10);
        return {
          dx: Math.cos(a) * dist,
          dy: Math.sin(a) * dist * 0.7 - dist * 0.15,
          size: 5 + ((i * 7 + seed) % 8),
        };
      }),
    [count, spread, seed],
  );
  return (
    <>
      {parts.map((p, i) => (
        <Particle key={i} x={x} y={y} {...p} color={color} burst={burst} />
      ))}
    </>
  );
}

function Particle({
  x,
  y,
  dx,
  dy,
  size,
  color,
  burst,
}: {
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  color: string;
  burst: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const b = burst.value;
    return {
      opacity: interpolate(b, [0, 0.1, 1], [0, 1, 0]),
      transform: [
        { translateX: dx * b },
        { translateY: dy * b + b * b * 40 },
        { scale: 1 - b * 0.5 },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
          shadowOpacity: 0.9,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    />
  );
}

export default function BowlingLane({ standing, throwState, onArrive }: Props) {
  const [dim, setDim] = useState({ w: 0, h: 0 });
  const prog = useSharedValue(0);
  const flash = useSharedValue(0);
  const burst = useSharedValue(0);
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

  const pinT = (row: number) => 0.8 + row * 0.05;
  const PIN_X = 0.42;

  const aim = throwState?.aim ?? 0;
  const isGiant = throwState?.powerup === "giant";
  const isMagnet = throwState?.powerup === "magnet";
  const isMuscle = throwState?.powerup === "muscle";

  const startP = project(0, 0.03);
  const endP = project(aim * 0.42, 0.8);
  const baseBall = w * 0.16;

  useEffect(() => {
    if (!throwState || w === 0) return;
    setEffect(throwState.powerup);
    const dur = isMuscle ? 560 : 820;
    prog.value = 0;
    prog.value = withTiming(
      1,
      { duration: dur, easing: Easing.in(Easing.quad) },
      (finished) => {
        if (finished && onArrive) runOnJS(onArrive)();
      },
    );
    // impact particle burst near the pins
    burst.value = 0;
    burst.value = withDelay(dur - 80, withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }));
    if (throwState.powerup === "lightning" || throwState.powerup === "bomb") {
      flash.value = withSequence(
        withTiming(0, { duration: dur - 120 }),
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

  // trailing echo (motion trail) — follows slightly behind the ball
  const trailStyle = useAnimatedStyle(() => {
    const p = Math.max(0, prog.value - (isMuscle ? 0.12 : 0.08));
    const curve = isMagnet ? Math.sin(p * Math.PI) * nearHalf * 0.35 : 0;
    const tx = interpolate(p, [0, 1], [startP.x, endP.x]) - curve;
    const ty = interpolate(p, [0, 1], [startP.y, endP.y]);
    const sc =
      interpolate(p, [0, 1], [startP.scale, endP.scale]) * (isGiant ? 1.7 : 1);
    const size = baseBall * sc;
    return {
      opacity: interpolate(prog.value, [0, 0.05, 0.85, 1], [0, 0.5, 0.5, 0]),
      width: size,
      height: size,
      borderRadius: size / 2,
      transform: [{ translateX: tx - size / 2 }, { translateY: ty - size / 2 }],
    };
  });

  // magnet field rings that orbit the ball
  const ringStyle = useAnimatedStyle(() => {
    const p = prog.value;
    const curve = Math.sin(p * Math.PI) * nearHalf * 0.35;
    const tx = interpolate(p, [0, 1], [startP.x, endP.x]) - curve;
    const ty = interpolate(p, [0, 1], [startP.y, endP.y]);
    const sc = interpolate(p, [0, 1], [startP.scale, endP.scale]);
    const size = baseBall * sc * 2.1;
    return {
      opacity: isMagnet ? interpolate(p, [0, 0.85, 1], [0.6, 0.6, 0]) : 0,
      width: size,
      height: size,
      borderRadius: size / 2,
      transform: [{ translateX: tx - size / 2 }, { translateY: ty - size / 2 }],
    };
  });

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const explosionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(burst.value, [0, 0.15, 1], [0, 0.85, 0]),
    transform: [{ scale: 0.3 + burst.value * 2.2 }],
  }));
  const shockStyle = useAnimatedStyle(() => ({
    opacity: interpolate(burst.value, [0, 0.1, 0.9], [0, 0.7, 0]),
    transform: [{ scale: 0.2 + burst.value * 3 }],
  }));

  const ballGrad = BALL_COLORS[throwState?.powerup ?? "none"];
  const burstColor = BURST_COLORS[throwState?.powerup ?? "none"];

  const gutterTop = pinDeckY;
  const laneH = nearY - pinDeckY;
  const woodSide = nearHalf - farHalf;
  const bedSide = nearHalf + gutter - (farHalf + gutter * 0.5);

  const arrows = [-0.55, -0.2, 0.2, 0.55];

  // futuristic floor grid rungs (perspective horizontal lines)
  const rungs = [0.14, 0.26, 0.38, 0.5, 0.62, 0.73, 0.83];

  // neon side edge line geometry
  const edge = (side: 1 | -1) => {
    const p1x = centerX + side * nearHalf;
    const p1y = nearY;
    const p2x = centerX + side * farHalf;
    const p2y = pinDeckY;
    const dx = p2x - p1x;
    const dy = p2y - p1y;
    const len = Math.hypot(dx, dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    return { midX: (p1x + p2x) / 2, midY: (p1y + p2y) / 2, len, angle };
  };

  const particleCount = effect === "bomb" ? 18 : effect === "lightning" ? 16 : effect === "muscle" ? 14 : 9;
  const particleSpread = effect === "bomb" ? 130 : effect === "muscle" ? 110 : 80;

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* deep space / cyber background */}
      <LinearGradient
        colors={["#02040d", "#081026", "#0a1533", "#02040d"]}
        locations={[0, 0.4, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {w > 0 && (
        <>
          {/* back wall glow field */}
          <LinearGradient
            colors={["#0a1a44", "#050a1f"]}
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: pinDeckY + 6 }}
          />
          {/* horizon neon line */}
          <View
            style={{
              position: "absolute",
              top: h * 0.2,
              left: w * 0.06,
              right: w * 0.06,
              height: 2,
              backgroundColor: NEON,
              borderRadius: 2,
              shadowColor: NEON,
              shadowOpacity: 0.9,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
          {/* secondary horizon glow */}
          <View
            style={{
              position: "absolute",
              top: h * 0.14,
              left: w * 0.2,
              right: w * 0.2,
              height: 1,
              backgroundColor: "rgba(120,80,255,0.6)",
              borderRadius: 2,
            }}
          />
          {/* back-wall vertical grid accents */}
          {[-0.32, -0.12, 0.12, 0.32].map((fx, i) => (
            <View
              key={`bw${i}`}
              style={{
                position: "absolute",
                top: h * 0.05,
                height: h * 0.15,
                left: centerX + fx * w,
                width: 1,
                backgroundColor: "rgba(34,225,255,0.18)",
              }}
            />
          ))}

          {/* pin pit (dark recess with neon rim) */}
          <View
            style={{
              position: "absolute",
              top: pinDeckY - h * 0.11,
              left: centerX - farHalf - 8,
              width: farHalf * 2 + 16,
              height: h * 0.12,
              backgroundColor: "#01030a",
              borderTopLeftRadius: 10,
              borderTopRightRadius: 10,
              borderTopWidth: 1.5,
              borderColor: NEON_DIM,
            }}
          />

          {/* gutter beds (dark trapezoids) */}
          <View
            style={{
              position: "absolute",
              top: gutterTop,
              left: centerX - (farHalf + gutter * 0.5) - bedSide,
              width: (farHalf + gutter * 0.5) * 2,
              height: 0,
              borderBottomWidth: laneH,
              borderBottomColor: "#020412",
              borderLeftWidth: bedSide,
              borderRightWidth: bedSide,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
            }}
          />

          {/* neon lane surface trapezoid */}
          <View
            style={{
              position: "absolute",
              top: gutterTop,
              left: centerX - farHalf - woodSide,
              width: farHalf * 2,
              height: 0,
              borderBottomWidth: laneH,
              borderBottomColor: "#0b1d4d",
              borderLeftWidth: woodSide,
              borderRightWidth: woodSide,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
            }}
          />
          {/* lane sheen gradient overlay */}
          <LinearGradient
            colors={[
              "rgba(34,225,255,0.28)",
              "rgba(20,60,140,0.10)",
              "rgba(6,14,40,0.0)",
              "rgba(80,120,255,0.18)",
            ]}
            locations={[0, 0.4, 0.7, 1]}
            style={{
              position: "absolute",
              top: pinDeckY,
              left: centerX - nearHalf,
              width: nearHalf * 2,
              height: laneH,
            }}
            pointerEvents="none"
          />

          {/* perspective floor grid rungs */}
          {rungs.map((t, i) => {
            const pp = project(0, t);
            const half = nearHalf + t * (farHalf - nearHalf);
            return (
              <View
                key={`rung${i}`}
                style={{
                  position: "absolute",
                  top: pp.y,
                  left: centerX - half,
                  width: half * 2,
                  height: 1.5,
                  backgroundColor: `rgba(34,225,255,${0.5 - t * 0.35})`,
                }}
              />
            );
          })}
          {/* center converging line */}
          <View
            style={{
              position: "absolute",
              top: pinDeckY,
              bottom: 0,
              left: centerX - 0.75,
              width: 1.5,
              backgroundColor: "rgba(34,225,255,0.25)",
            }}
          />

          {/* neon lane edges */}
          {([1, -1] as const).map((side) => {
            const e = edge(side);
            return (
              <View
                key={`edge${side}`}
                style={{
                  position: "absolute",
                  left: e.midX - e.len / 2,
                  top: e.midY - 1.5,
                  width: e.len,
                  height: 3,
                  backgroundColor: NEON,
                  borderRadius: 2,
                  transform: [{ rotate: `${e.angle}deg` }],
                  shadowColor: NEON,
                  shadowOpacity: 0.9,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 0 },
                }}
              />
            );
          })}

          {/* aiming chevrons */}
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
                  borderBottomColor: "rgba(34,225,255,0.7)",
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

          {/* shockwave ring on impact */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shock,
              { left: endP.x - 60, top: endP.y - 60, borderColor: burstColor },
              shockStyle,
            ]}
          />
          {/* explosion core */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.explosion,
              {
                left: endP.x - 55,
                top: endP.y - 70,
                backgroundColor: burstColor,
                shadowColor: burstColor,
              },
              explosionStyle,
            ]}
          />
          {/* particle burst */}
          {throwState && (
            <Particles
              x={endP.x}
              y={endP.y - 10}
              color={burstColor}
              burst={burst}
              count={particleCount}
              spread={particleSpread}
              seed={throwState.key}
            />
          )}

          {/* magnet field ring */}
          <Animated.View
            pointerEvents="none"
            style={[styles.fieldRing, ringStyle]}
          />

          {/* ball trail echo */}
          {throwState && (
            <Animated.View style={[styles.ball, styles.ballTrail, trailStyle]}>
              <LinearGradient
                colors={ballGrad}
                start={{ x: 0.3, y: 0.1 }}
                end={{ x: 0.7, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          )}

          {/* ball */}
          {throwState && (
            <Animated.View
              style={[
                styles.ball,
                { shadowColor: ballGrad[0] },
                ballStyle,
              ]}
            >
              <LinearGradient
                colors={ballGrad}
                start={{ x: 0.3, y: 0.1 }}
                end={{ x: 0.7, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.ballCore} />
              <View style={styles.ballShine} />
            </Animated.View>
          )}

          {/* full-screen power flash */}
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: effect === "bomb" ? "#FFB35C" : "#7FE9FF" },
              flashStyle,
            ]}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden", backgroundColor: "#02040d" },
  pinWrap: { position: "absolute", alignItems: "center", justifyContent: "flex-end" },
  pinGlow: {
    position: "absolute",
    backgroundColor: "rgba(34,225,255,0.18)",
    borderRadius: 999,
  },
  pinBody: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "#EAF7FF",
    borderRadius: 40,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderColor: "#22E1FF",
    overflow: "hidden",
  },
  pinStripe: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: "#00C2FF",
  },
  pinStripeThin: { height: 3, backgroundColor: "#7A5CFF" },
  pinHead: {
    position: "absolute",
    top: -2,
    backgroundColor: "#EAF7FF",
    borderRadius: 40,
    borderWidth: 1,
    borderColor: "#22E1FF",
  },
  ball: {
    position: "absolute",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.9,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  ballTrail: { opacity: 0.5 },
  ballCore: {
    position: "absolute",
    top: "30%",
    left: "30%",
    width: "40%",
    height: "40%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  ballShine: {
    position: "absolute",
    top: "14%",
    left: "18%",
    width: "24%",
    height: "24%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  explosion: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    shadowOpacity: 0.9,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  shock: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
  },
  fieldRing: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(57,255,154,0.7)",
  },
});
