import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { colors, font, radius, spacing } from "@/src/theme/theme";
import { Frame, scoreGame, rollSymbol } from "@/src/game/engine";

interface Props {
  frames: Frame[];
  currentFrame: number;
  active?: boolean;
  testID?: string;
}

export default function Scorecard({ frames, currentFrame, active = true, testID }: Props) {
  const { frameScores } = scoreGame(frames);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ x: Math.max(0, currentFrame - 3) * 42, animated: true });
  }, [currentFrame]);

  return (
    <ScrollView
      ref={scrollRef}
      testID={testID}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {frames.map((f, i) => {
        const isCurrent = active && i === currentFrame;
        const rollCount = i === 9 ? 3 : 2;
        return (
          <View
            key={i}
            style={[
              styles.frame,
              i === 9 && styles.frame10,
              isCurrent && styles.frameActive,
            ]}
          >
            <View style={styles.rollsRow}>
              {Array.from({ length: rollCount }).map((_, r) => (
                <View key={r} style={[styles.rollCell, i === 9 && styles.rollCell10]}>
                  <Text style={styles.rollText}>{rollSymbol(i, r, f.rolls)}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.frameScore}>
              {frameScores[i] === null || frameScores[i] === undefined
                ? ""
                : frameScores[i]}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", paddingHorizontal: spacing.xs, gap: 3 },
  frame: {
    width: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: "hidden",
    flexShrink: 0,
  },
  frame10: { width: 54 },
  frameActive: { borderColor: colors.brandPrimary, borderWidth: 2 },
  rollsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rollCell: {
    flex: 1,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  rollCell10: {},
  rollText: {
    fontFamily: font.display,
    fontSize: 12,
    color: colors.onSurface,
  },
  frameScore: {
    fontFamily: font.display,
    fontSize: 14,
    textAlign: "center",
    height: 22,
    lineHeight: 22,
    color: colors.onSurface,
  },
});
