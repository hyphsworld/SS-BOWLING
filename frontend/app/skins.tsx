import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";

import { colors, font, radius, spacing, type, shadow } from "@/src/theme/theme";
import { SKINS, isSkinUnlocked, getSelectedSkin, setSelectedSkin, UnlockStats } from "@/src/game/skins";
import { ensurePlayer } from "@/src/store/player";
import { api } from "@/src/api/client";
import { playSound } from "@/src/audio/sounds";

export default function Skins() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState("classic");
  const [stats, setStats] = useState<UnlockStats>({ games: 0, best: 0, total_strikes: 0 });

  useEffect(() => {
    getSelectedSkin().then(setSelected);
    (async () => {
      try {
        const p = await ensurePlayer();
        const s = await api.getStats(p.id);
        setStats({ games: s.games || 0, best: s.best || 0, total_strikes: s.total_strikes || 0 });
      } catch (e) {}
    })();
  }, []);

  const choose = async (id: string, unlocked: boolean) => {
    if (!unlocked) return;
    setSelected(id);
    await setSelectedSkin(id);
    playSound("tap");
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="skins-back-button" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Ball Skins</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {SKINS.map((skin, i) => {
          const unlocked = isSkinUnlocked(skin, stats);
          const active = selected === skin.id;
          return (
            <Animated.View key={skin.id} entering={FadeInDown.delay(i * 70)}>
              <Pressable
                testID={`skin-${skin.id}`}
                onPress={() => choose(skin.id, unlocked)}
                style={[styles.card, active && styles.cardActive, !unlocked && styles.cardLocked]}
              >
                <LinearGradient
                  colors={[skin.swatch, "#00000022"]}
                  start={{ x: 0.2, y: 0.1 }}
                  end={{ x: 0.8, y: 1 }}
                  style={styles.ball}
                >
                  <View style={styles.ballShine} />
                  {!unlocked && (
                    <View style={styles.lockOverlay}>
                      <Ionicons name="lock-closed" size={22} color="#fff" />
                    </View>
                  )}
                </LinearGradient>
                <View style={styles.info}>
                  <Text style={styles.name}>{skin.name}</Text>
                  <Text style={styles.desc}>{skin.desc}</Text>
                  {!unlocked ? (
                    <View style={styles.pill}>
                      <Ionicons name="lock-closed" size={11} color={colors.brandPrimary} />
                      <Text style={styles.pillText}>{skin.unlockText}</Text>
                    </View>
                  ) : active ? (
                    <View style={[styles.pill, styles.pillActive]}>
                      <Ionicons name="checkmark-circle" size={13} color={colors.brandSecondary} />
                      <Text style={[styles.pillText, { color: colors.brandSecondary }]}>Equipped</Text>
                    </View>
                  ) : (
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>Tap to equip</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: font.display, fontSize: type["2xl"], color: colors.onSurface },
  list: { padding: spacing.lg, gap: spacing.md },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardActive: { borderColor: colors.brandSecondary },
  cardLocked: { opacity: 0.75 },
  ball: {
    width: 68,
    height: 68,
    borderRadius: 34,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  ballShine: {
    position: "absolute",
    top: 10,
    left: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  lockOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)" },
  info: { flex: 1, gap: 4 },
  name: { fontFamily: font.display, fontSize: type.lg, color: colors.onSurface },
  desc: { fontFamily: font.text, fontSize: type.sm, color: colors.onSurfaceSecondary },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginTop: 2,
  },
  pillActive: { backgroundColor: "rgba(52,199,89,0.15)" },
  pillText: { fontFamily: font.display, fontSize: type.sm, color: colors.onSurfaceSecondary },
});
