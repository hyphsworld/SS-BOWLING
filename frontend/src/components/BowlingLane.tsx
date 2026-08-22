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
import { colors, radius } from "@/src/theme/theme";
import { PINS, AIM_SCALE } from "@/src/game/engine";
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

const BALL_COLORS: Record<string, string> = {
  magnet: colors.brandSecondary,
  giant: colors.brand,
  muscle: colors.brandPrimary,
  bomb: "#1A1A1A",
  lightning: colors.brandTertiary,
  none: colors.brandPrimary,
};

function Pin({
  up,
  cx,
  cy,
  size,
}: {
  up: boolean;
  cx: number;
  cy: number;
  size: number;
}) {
  const fall = useSharedValue(up ? 0 : 1);
  useEffect(() => {
    fall.value = withTiming(up ? 0 : 1, {
      duration: up ? 120 : 420,
      easing: Easing.out(Easing.quad),
    });
  }, [up]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - fall.value,
    transform: [
      { translateX: fall.value * (cx > 0 ? 22 : -22) },
      { translateY: fall.value * 34 },
      { rotate: `${fall.value * 68}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.pin,
        {
          left: cx - size / 2,
          top: cy - size * 0.7,
          width: size,
          height: size * 1.4,
          borderRadius: size / 2,
        },
        style,
      ]}
    >
      <View style={[styles.pinNeck, { top: size * 0.28, height: size * 0.16 }]} />
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
  const laneW = w * 0.74;
  const laneLeft = (w - laneW) / 2;
  const laneCenter = laneLeft + laneW / 2;
  const pinTop = h * 0.08;
  const clusterH = h * 0.17;
  const spreadUnit = laneW * 0.15;

  const pinPos = (x: number, row: number) => {
    const depthT = row / 3;
    const cx = laneCenter + x * spreadUnit * (0.6 + 0.4 * (1 - depthT));
    const cy = pinTop + (1 - depthT) * clusterH;
    const size = 24 * (1 - depthT * 0.16);
    return { cx, cy, size };
  };

  const aim = throwState?.aim ?? 0;
  const targetX = laneCenter + aim * AIM_SCALE * spreadUnit;
  const startX = laneCenter;
  const startY = h * 0.92;
  const targetY = pinTop + clusterH;
  const isGiant = throwState?.powerup === "giant";
  const isMagnet = throwState?.powerup === "magnet";
  const ballSize = isGiant ? 52 : 30;

  useEffect(() => {
    if (!throwState || w === 0) return;
    setEffect(throwState.powerup);
    prog.value = 0;
    prog.value = withTiming(
      1,
      { duration: 780, easing: Easing.in(Easing.quad) },
      (finished) => {
        if (finished && onArrive) runOnJS(onArrive)();
      },
    );
    if (throwState.powerup === "lightning" || throwState.powerup === "bomb") {
      flash.value = 0;
      flash.value = withSequence(
        withTiming(0, { duration: 620 }),
        withTiming(1, { duration: 90 }),
        withTiming(0, { duration: 420 }),
      );
    }
  }, [throwState?.key]);

  const ballStyle = useAnimatedStyle(() => {
    const magnetCurve = isMagnet
      ? Math.sin(prog.value * Math.PI) * spreadUnit * 0.6
      : 0;
    const tx = interpolate(prog.value, [0, 1], [startX, targetX]) - magnetCurve;
    const ty = interpolate(prog.value, [0, 1], [startY, targetY]);
    const opacity = interpolate(prog.value, [0, 0.82, 1], [1, 1, 0]);
    return {
      opacity,
      transform: [{ translateX: tx - ballSize / 2 }, { translateY: ty - ballSize / 2 }],
    };
  });

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const explosionStyle = useAnimatedStyle(() => ({
    opacity: flash.value,
    transform: [{ scale: 0.4 + flash.value * 1.6 }],
  }));

  const ballColor = BALL_COLORS[throwState?.powerup ?? "none"];

  return (
    <View style={styles.container} onLayout={onLayout}>
      <LinearGradient
        colors={["#FFE9A8", "#FFF9F0"]}
        style={StyleSheet.absoluteFill}
      />
      {w > 0 && (
        <>
          {/* Lane */}
          <View
            style={[
              styles.lane,
              { left: laneLeft, width: laneW, top: pinTop - 12, bottom: 0 },
            ]}
          >
            <LinearGradient
              colors={[colors.woodDark, colors.wood]}
              style={StyleSheet.absoluteFill}
            />
            {/* aiming arrows */}
            {[-0.9, -0.3, 0.3, 0.9].map((ax, i) => (
              <View
                key={i}
                style={[
                  styles.arrow,
                  {
                    left: laneW / 2 + ax * spreadUnit - 5,
                    bottom: h * 0.28,
                  },
                ]}
              />
            ))}
          </View>
          {/* gutters */}
          <View style={[styles.gutter, { left: laneLeft - 10, top: pinTop - 12 }]} />
          <View style={[styles.gutter, { left: laneLeft + laneW + 2, top: pinTop - 12 }]} />

          {/* Pins */}
          {Object.entries(PINS).map(([idStr, p]) => {
            const id = Number(idStr);
            const { cx, cy, size } = pinPos(p.x, p.row);
            return <Pin key={id} up={standing.includes(id)} cx={cx} cy={cy} size={size} />;
          })}

          {/* explosion for bomb / laser */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.explosion,
              {
                left: targetX - 60,
                top: targetY - 60,
                backgroundColor:
                  effect === "bomb" ? "rgba(255,45,85,0.55)" : "rgba(255,214,10,0.6)",
              },
              explosionStyle,
            ]}
          />

          {/* ball */}
          {throwState && (
            <Animated.View
              style={[
                styles.ball,
                {
                  width: ballSize,
                  height: ballSize,
                  borderRadius: ballSize / 2,
                  backgroundColor: ballColor,
                },
                ballStyle,
              ]}
            >
              <View style={styles.ballShine} />
            </Animated.View>
          )}

          {/* lightning flash overlay */}
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.brandTertiary },
              flashStyle,
            ]}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden" },
  lane: {
    position: "absolute",
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: "#C9B98A",
    overflow: "hidden",
  },
  gutter: {
    position: "absolute",
    width: 8,
    bottom: 0,
    backgroundColor: colors.gutter,
    borderRadius: radius.sm,
  },
  arrow: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: colors.brandPrimary,
    opacity: 0.5,
  },
  pin: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
  },
  pinNeck: {
    position: "absolute",
    width: "70%",
    backgroundColor: colors.brandPrimary,
    borderRadius: 2,
  },
  ball: {
    position: "absolute",
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  ballShine: {
    position: "absolute",
    top: 5,
    left: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  explosion: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
  },
});
