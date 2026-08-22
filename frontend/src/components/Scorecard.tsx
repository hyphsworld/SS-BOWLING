import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { colors, font, radius, spacing } from "@/src/theme/theme";
import { Frame, scoreGame, rollSymbol } from "@/src/game/engine";

interface Props {
  frames: Frame[];
  currentFrame: number;
  active?: boolean;
  dark?: boolean;
  testID?: string;
}

export default function Scorecard({
  frames,
  currentFrame,
  active = true,
  dark = false,
  testID,
}: Props) {
  const { frameScores } = scoreGame(frames);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ x: Math.max(0, currentFrame - 3) * 42, animated: true });
  }, [currentFrame]);

  const cellBg = dark ? "#1C1C22" : colors.surfaceSecondary;
  const borderC = dark ? "#3A3A42" : colors.border;
  const textC = dark ? "#FFFFFF" : colors.onSurface;
  const numC = dark ? colors.brand : colors.brandPrimary;

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
          <View key={i} style={styles.frameCol}>
            <Text style={[styles.frameNum, { color: numC }]}>{i + 1}</Text>
            <View
              style={[
                styles.frame,
                i === 9 && styles.frame10,
                { backgroundColor: cellBg, borderColor: borderC },
                isCurrent && { borderColor: colors.brand, borderWidth: 2 },
              ]}
            >
              <View style={[styles.rollsRow, { borderBottomColor: borderC }]}>
                {Array.from({ length: rollCount }).map((_, r) => (
                  <View
                    key={r}
                    style={[
                      styles.rollCell,
                      { borderRightColor: borderC },
                      r === rollCount - 1 && { borderRightWidth: 0 },
                    ]}
                  >
                    <Text style={[styles.rollText, { color: textC }]}>
                      {rollSymbol(i, r, f.rolls)}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.frameScore, { color: textC }]}>
                {frameScores[i] === null || frameScores[i] === undefined
                  ? ""
                  : frameScores[i]}
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", paddingHorizontal: spacing.xs, gap: 3 },
  frameCol: { alignItems: "center", flexShrink: 0 },
  frameNum: { fontFamily: font.display, fontSize: 11, marginBottom: 1 },
  frame: {
    width: 38,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  frame10: { width: 54 },
  rollsRow: { flexDirection: "row", borderBottomWidth: 1 },
  rollCell: {
    flex: 1,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
  },
  rollText: { fontFamily: font.display, fontSize: 12 },
  frameScore: {
    fontFamily: font.display,
    fontSize: 14,
    textAlign: "center",
    height: 22,
    lineHeight: 22,
  },
});
