import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import PrimaryButton from "@/src/components/PrimaryButton";
import { colors, font, radius, spacing, type, shadow } from "@/src/theme/theme";
import { api } from "@/src/api/client";
import { ensurePlayer } from "@/src/store/player";

const TROPHY =
  "https://images.unsplash.com/photo-1578269174936-2709b6aeb913?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjh8MHwxfHNlYXJjaHwxfHx0cm9waHklMjBjYXJ0b29uJTIwd2lubmVyfGVufDB8fHx8MTc4NzM5MTYxMnww&ixlib=rb-4.1.0&q=85";

export default function Results() {
  const params = useLocalSearchParams<{
    mode?: string;
    myScore?: string;
    oppScore?: string;
    oppName?: string;
    result?: string;
    strikes?: string;
    spares?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const mode = params.mode || "solo";
  const myScore = Number(params.myScore || 0);
  const oppScore = Number(params.oppScore || 0);
  const oppName = params.oppName || "Opponent";
  const result = params.result || "";
  const strikes = Number(params.strikes || 0);
  const spares = Number(params.spares || 0);

  const [submitting, setSubmitting] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const p = await ensurePlayer();
        await api.submitScore({
          player_id: p.id,
          name: p.name,
          score: myScore,
          mode,
          strikes,
          spares,
          result: result || null,
        });
      } catch (e) {}
      setSubmitting(false);
    })();
  }, []);

  const isVs = mode === "cpu" || mode === "multiplayer";
  const won = result === "win";
  const tie = result === "tie";

  let headline = "NICE GAME!";
  if (mode === "solo") headline = myScore >= 150 ? "ULTRA STRIKE!" : "NICE GAME!";
  else if (won) headline = "YOU WIN!";
  else if (tie) headline = "IT'S A TIE!";
  else headline = "SO CLOSE!";

  const accent = won || mode === "solo" ? colors.brandSecondary : colors.brandPrimary;

  return (
    <View style={styles.container}>
      <View style={[styles.body, { paddingTop: insets.top + spacing.xl }]}>
        <Animated.Text entering={FadeInDown.duration(400)} style={[styles.headline, { color: accent }]}>
          {headline}
        </Animated.Text>

        <Animated.View entering={ZoomIn.delay(150).duration(500)} style={styles.trophyWrap}>
          <Image source={{ uri: TROPHY }} style={styles.trophy} contentFit="cover" />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250)} style={styles.scoreCard}>
          {isVs ? (
            <View style={styles.vsRow}>
              <View style={styles.vsCol}>
                <Text style={styles.vsName}>YOU</Text>
                <Text style={[styles.vsScore, won && { color: colors.brandSecondary }]}>
                  {myScore}
                </Text>
              </View>
              <Text style={styles.vsDivider}>vs</Text>
              <View style={styles.vsCol}>
                <Text style={styles.vsName} numberOfLines={1}>
                  {oppName}
                </Text>
                <Text style={[styles.vsScore, !won && !tie && { color: colors.brandPrimary }]}>
                  {oppScore}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.soloScore}>
              <Text style={styles.soloLabel}>FINAL SCORE</Text>
              <Text style={styles.soloValue}>{myScore}</Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Ionicons name="flame" size={16} color={colors.brandPrimary} />
              <Text style={styles.statText}>{strikes} Strikes</Text>
            </View>
            <View style={styles.statChip}>
              <Ionicons name="checkmark-done" size={16} color={colors.brandSecondary} />
              <Text style={styles.statText}>{spares} Spares</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <PrimaryButton
          testID="play-again-button"
          label="Play Again"
          icon="refresh"
          variant="primary"
          onPress={() =>
            router.replace(mode === "multiplayer" ? "/multiplayer" : `/game?mode=${mode}`)
          }
        />
        <PrimaryButton
          testID="home-button"
          label="Home"
          icon="home"
          variant="outline"
          onPress={() => router.replace("/")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  body: { flex: 1, alignItems: "center", paddingHorizontal: spacing.lg, gap: spacing.lg },
  headline: { fontFamily: font.display, fontSize: type["4xl"], textAlign: "center" },
  trophyWrap: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: colors.brand,
    ...shadow.card,
  },
  trophy: { width: "100%", height: "100%" },
  scoreCard: {
    width: "100%",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadow.card,
  },
  vsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  vsCol: { alignItems: "center", flex: 1 },
  vsName: { fontFamily: font.display, fontSize: type.lg, color: colors.onSurfaceSecondary },
  vsScore: { fontFamily: font.display, fontSize: type["4xl"], color: colors.onSurface },
  vsDivider: { fontFamily: font.text, fontSize: type.xl, color: colors.onSurfaceSecondary },
  soloScore: { alignItems: "center" },
  soloLabel: { fontFamily: font.display, fontSize: type.base, color: colors.onSurfaceSecondary, letterSpacing: 2 },
  soloValue: { fontFamily: font.display, fontSize: 72, color: colors.onSurface },
  statsRow: { flexDirection: "row", gap: spacing.md, justifyContent: "center" },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statText: { fontFamily: font.display, fontSize: type.base, color: colors.onSurface },
  footer: { paddingHorizontal: spacing.lg, gap: spacing.md },
});
