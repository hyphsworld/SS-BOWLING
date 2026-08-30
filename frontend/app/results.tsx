import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import PrimaryButton from "@/src/components/PrimaryButton";
import { colors, font, radius, spacing, type, shadow } from "@/src/theme/theme";
import { api } from "@/src/api/client";
import { ensurePlayer } from "@/src/store/player";
import { playSound } from "@/src/audio/sounds";
import { speak, stopSpeaking } from "@/src/audio/speech";
import { recordRivalResult } from "@/src/store/rival";

const TROPHY =
  "https://images.unsplash.com/photo-1578269174936-2709b6aeb913?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjh8MHwxfHNlYXJjaHwxfHx0cm9waHklMjBjYXJ0b29uJTIwd2lubmVyfGVufDB8fHx8MTc4NzM5MTYxMnww&ixlib=rb-4.1.0&q=85";

function fallbackCoachTip(score: number, strikes: number, spares: number) {
  if (strikes >= 4) return "You were finding the pocket. Keep that same aim and tighten your power timing to turn those strikes into a streak.";
  if (spares >= 2) return "Your spare game was solid. On the first ball, aim a little closer to the pocket so you leave fewer cleanup shots.";
  if (score >= 150) return "Strong game. Keep your aim steady and lock power in the sweet zone to turn more good frames into strikes.";
  return "Aim for the pocket between the 1 and 3 pins and lock your power in the sweet zone for a cleaner next game.";
}

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

  const [coachTip, setCoachTip] = useState<string | null>(null);

  useEffect(() => {
    const win = result === "win" || (mode === "solo" && myScore >= 150);
    playSound(win ? "win" : "spare");
    const fallback = fallbackCoachTip(myScore, strikes, spares);
    let cancelled = false;
    let coachTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      if (!cancelled) setCoachTip((current) => current || fallback);
    }, 2200);

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

      if (mode === "cpu" && (result === "win" || result === "lose" || result === "tie")) {
        recordRivalResult(result).catch(() => {});
      }

      try {
        const r = await Promise.race([
          api.aiCoach({ score: myScore, strikes, spares, mode, result: result || null }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("coach timeout")), 4500)),
        ]);
        if (cancelled) return;
        const tip = r?.text?.trim() || fallback;
        if (coachTimer) clearTimeout(coachTimer);
        coachTimer = null;
        setCoachTip(tip);
        if (tip) speak(tip);
      } catch (e) {
        if (cancelled) return;
        if (coachTimer) clearTimeout(coachTimer);
        coachTimer = null;
        setCoachTip((current) => current || fallback);
      }
    })();

    return () => {
      cancelled = true;
      if (coachTimer) clearTimeout(coachTimer);
      stopSpeaking();
    };
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
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={[styles.body, { paddingTop: insets.top + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
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
                <Text style={[styles.vsScore, won && { color: colors.brandSecondary }]}>{myScore}</Text>
              </View>
              <Text style={styles.vsDivider}>vs</Text>
              <View style={styles.vsCol}>
                <Text style={styles.vsName} numberOfLines={1}>{oppName}</Text>
                <Text style={[styles.vsScore, !won && !tie && { color: colors.brandPrimary }]}>{oppScore}</Text>
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

        <Animated.View entering={FadeInDown.delay(350)} style={styles.coachCard}>
          <View style={styles.coachHeader}>
            <Ionicons name="school" size={18} color={colors.brandPrimary} />
            <Text style={styles.coachTitle}>Coach Luna says</Text>
            {coachTip && (
              <Pressable testID="coach-speak-button" onPress={() => speak(coachTip)} style={styles.speakBtn} hitSlop={8}>
                <Ionicons name="volume-high" size={18} color={colors.brandPrimary} />
              </Pressable>
            )}
          </View>
          {coachTip ? (
            <Text style={styles.coachText}>{coachTip}</Text>
          ) : (
            <View style={styles.coachLoading}>
              <ActivityIndicator color={colors.brandPrimary} size="small" />
              <Text style={styles.coachLoadingText}>Analyzing your game…</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <PrimaryButton
          testID="play-again-button"
          label="Play Again"
          icon="refresh"
          variant="primary"
          onPress={() => router.replace(mode === "multiplayer" ? "/multiplayer" : `/game?mode=${mode}`)}
        />
        <PrimaryButton testID="home-button" label="Home" icon="home" variant="outline" onPress={() => router.replace("/")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  bodyScroll: { flex: 1 },
  body: { alignItems: "center", paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: spacing.lg },
  headline: { fontFamily: font.display, fontSize: type["4xl"], textAlign: "center" },
  trophyWrap: { width: 160, height: 160, borderRadius: 80, overflow: "hidden", borderWidth: 4, borderColor: colors.brand, ...shadow.card },
  trophy: { width: "100%", height: "100%" },
  scoreCard: { width: "100%", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.lg, ...shadow.card },
  vsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  vsCol: { alignItems: "center", flex: 1 },
  vsName: { fontFamily: font.display, fontSize: type.lg, color: colors.onSurfaceSecondary },
  vsScore: { fontFamily: font.display, fontSize: type["4xl"], color: colors.onSurface },
  vsDivider: { fontFamily: font.text, fontSize: type.xl, color: colors.onSurfaceSecondary },
  soloScore: { alignItems: "center" },
  soloLabel: { fontFamily: font.display, fontSize: type.base, color: colors.onSurfaceSecondary, letterSpacing: 2 },
  soloValue: { fontFamily: font.display, fontSize: 72, color: colors.onSurface },
  statsRow: { flexDirection: "row", gap: spacing.md, justifyContent: "center" },
  statChip: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  statText: { fontFamily: font.display, fontSize: type.base, color: colors.onSurface },
  coachCard: { width: "100%", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1.5, borderColor: colors.brandPrimary, ...shadow.card },
  coachHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  coachTitle: { fontFamily: font.display, fontSize: type.lg, color: colors.brandPrimary },
  speakBtn: { marginLeft: "auto", padding: 4 },
  coachText: { fontFamily: font.text, fontSize: type.base, color: colors.onSurface, lineHeight: 22 },
  coachLoading: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  coachLoadingText: { fontFamily: font.text, fontSize: type.base, color: colors.onSurfaceSecondary },
  footer: { paddingHorizontal: spacing.lg, gap: spacing.md },
});
