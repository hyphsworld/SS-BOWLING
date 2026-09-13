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
  const [ownedSkins, setOwnedSkins] = useState<string[]>([]);
  const [balance, setBalance] = useState(0);
  const [buying, setBuying] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getSelectedSkin().then(setSelected);
    (async () => {
      try {
        const p = await ensurePlayer();
        const s = await api.getStats(p.id);
        setStats({ games: s.games || 0, best: s.best || 0, total_strikes: s.total_strikes || 0 });
        const [owned, wallet] = await Promise.all([
          api.getSkinUnlocks().catch(() => [] as string[]),
          api.getWalletBalance().catch(() => 0),
        ]);
        setOwnedSkins(owned);
        setBalance(wallet);
      } catch (e) {}
    })();
  }, []);

  const choose = async (skin: (typeof SKINS)[number], unlocked: boolean) => {
    if (!unlocked && skin.unlock.points) {
      if (buying) return;
      setBuying(skin.id);
      setNotice("");
      try {
        const result = await api.purchaseSkin(skin.id);
        setOwnedSkins((current) => current.includes(skin.id) ? current : [...current, skin.id]);
        setBalance(result.balance);
        setSelected(skin.id);
        await setSelectedSkin(skin.id);
        setNotice(skin.name + " unlocked permanently.");
        playSound("powerup");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Purchase could not be completed.");
      } finally {
        setBuying(null);
      }
      return;
    }
    if (!unlocked) return;
    setSelected(skin.id);
    await setSelectedSkin(skin.id);
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

      <View style={styles.walletRow}>
        <Ionicons name="diamond" size={16} color={colors.brandPrimary} />
        <Text style={styles.walletText}>{balance.toLocaleString()} Cool Points</Text>
      </View>
      {!!notice && <Text style={styles.notice}>{notice}</Text>}
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {SKINS.map((skin, i) => {
          const unlocked = isSkinUnlocked(skin, stats, ownedSkins);
          const active = selected === skin.id;
          return (
            <Animated.View key={skin.id} entering={FadeInDown.delay(i * 70)}>
              <Pressable
                testID={`skin-${skin.id}`}
                onPress={() => choose(skin, unlocked)}
                style={[styles.card, active && styles.cardActive, !unlocked && styles.cardLocked]}
              >
                <LinearGradient
                  colors={[skin.swatch, "#00000022"]}
                  start={{ x: 0.2, y: 0.1 }}
                  end={{ x: 0.8, y: 1 }}
                  style={styles.ball}
                >
                  <View style={styles.ballShine} />
                  {skin.effect && unlocked && (
                    <Ionicons
                      name={skin.effect === "fire" ? "flame" : "snow"}
                      size={30}
                      color={skin.effect === "fire" ? "#FFD84D" : "#FFFFFF"}
                      style={styles.effectIcon}
                    />
                  )}
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
                      <Text style={styles.pillText}>{buying === skin.id ? "Unlocking…" : skin.unlockText}</Text>
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
  walletRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6 },
  walletText: { fontFamily: font.display, color: colors.brandPrimary, fontSize: type.base },
  notice: { fontFamily: font.text, color: colors.brandSecondary, textAlign: "center", paddingHorizontal: spacing.lg, paddingBottom: 4 },
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
  effectIcon: { textShadowColor: "rgba(255,255,255,0.9)", textShadowRadius: 10 },
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
