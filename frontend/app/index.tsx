import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ImageBackground,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import PrimaryButton from "@/src/components/PrimaryButton";
import SoundToggle from "@/src/components/SoundToggle";
import { colors, font, radius, spacing, type, shadow } from "@/src/theme/theme";
import { ensurePlayer, getName } from "@/src/store/player";

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("Bowler");

  useEffect(() => {
    ensurePlayer()
      .then((p) => setName(p.name))
      .catch(() => {});
    getName().then((n) => n && setName(n));
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.heroWrap}>
        <ImageBackground
          source={require("@/assets/images/super-strike-cover.png")}
          resizeMode="cover"
          imageStyle={styles.coverImage}
          style={StyleSheet.absoluteFill}
        >
          <LinearGradient
            colors={["rgba(0,0,0,0.16)", "rgba(0,0,0,0.08)", "rgba(0,0,0,0.84)"]}
            locations={[0, 0.54, 1]}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.pill}>
            <Ionicons name="person-circle" size={18} color={colors.onSurface} />
            <Text style={styles.pillText} numberOfLines={1}>
              {name}
            </Text>
          </View>
          <View style={styles.topRight}>
            <Pressable
              testID="leaderboard-icon-button"
              onPress={() => router.push("/leaderboard")}
              style={styles.pill}
            >
              <Ionicons name="trophy" size={18} color={colors.brandPrimary} />
            </Pressable>
            <SoundToggle />
          </View>
        </View>

        <Animated.View
          entering={FadeInDown.duration(500)}
          style={styles.modeOverlay}
        >
          <Text style={styles.chooseMode}>CHOOSE YOUR GAME</Text>
          <View style={styles.modeRow}>
            <Pressable testID="mode-solo-button" style={[styles.coverMode, styles.soloMode]} onPress={() => router.push("/game?mode=solo")}>
              <Ionicons name="game-controller" size={20} color="#FFFFFF" />
              <Text style={styles.coverModeText}>SOLO</Text>
            </Pressable>
            <Pressable testID="mode-cpu-button" style={[styles.coverMode, styles.cpuMode]} onPress={() => router.push("/game?mode=cpu")}>
              <Ionicons name="hardware-chip" size={20} color="#FFFFFF" />
              <Text style={styles.coverModeText}>VS CPU</Text>
            </Pressable>
            <Pressable testID="mode-multiplayer-button" style={[styles.coverMode, styles.multiMode]} onPress={() => router.push("/multiplayer")}>
              <Ionicons name="people" size={20} color="#101014" />
              <Text style={[styles.coverModeText, styles.multiModeText]}>MULTI</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>

      <View style={[styles.menu, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Animated.View entering={FadeInDown.delay(320)}>
          <PrimaryButton
            testID="ai-coach-button"
            label="Ask Coach Luna"
            icon="chatbubbles"
            variant="outline"
            onPress={() => router.push("/coach")}
          />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(380)} style={styles.secondaryRow}>
          <Pressable
            testID="nav-leaderboard-button"
            style={styles.smallBtn}
            onPress={() => router.push("/leaderboard")}
          >
            <Ionicons name="trophy-outline" size={18} color={colors.onSurface} />
            <Text style={styles.smallBtnText}>Leaderboard</Text>
          </Pressable>
          <Pressable
            testID="nav-profile-button"
            style={styles.smallBtn}
            onPress={() => router.push("/profile")}
          >
            <Ionicons name="stats-chart-outline" size={18} color={colors.onSurface} />
            <Text style={styles.smallBtnText}>My Stats</Text>
          </Pressable>
          <Pressable
            testID="nav-skins-button"
            style={styles.smallBtn}
            onPress={() => router.push("/skins")}
          >
            <Ionicons name="tennisball-outline" size={18} color={colors.onSurface} />
            <Text style={styles.smallBtnText}>Ball Skins</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const { height } = Dimensions.get("window");
const heroHeight = Math.min(650, Math.max(470, height * 0.67));

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  heroWrap: { height: heroHeight, overflow: "hidden" },
  coverImage: { opacity: 1 },
  brandMark: {
    position: "absolute",
    top: 70,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.78)",
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  brandMarkText: {
    fontFamily: font.display,
    fontSize: type.lg,
    letterSpacing: 3,
    color: "#FFFFFF",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: radius.pill,
    maxWidth: 180,
    ...shadow.card,
  },
  pillText: { fontFamily: font.display, fontSize: type.base, color: colors.onSurface },
  topRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  modeOverlay: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.lg,
    backgroundColor: "rgba(5,5,10,0.82)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.86)",
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  chooseMode: { fontFamily: font.display, fontSize: type.base, color: "#FFFFFF", textAlign: "center", letterSpacing: 2, marginBottom: spacing.sm },
  modeRow: { flexDirection: "row", gap: spacing.sm },
  coverMode: { flex: 1, minHeight: 62, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", gap: 3, borderWidth: 2, borderColor: "rgba(255,255,255,0.75)" },
  soloMode: { backgroundColor: "#E91E73" },
  cpuMode: { backgroundColor: "#087DDC" },
  multiMode: { backgroundColor: "#A8CE00" },
  coverModeText: { fontFamily: font.display, fontSize: type.sm, color: "#FFFFFF", letterSpacing: 0.4 },
  multiModeText: { color: "#101014" },
  titleSmall: {
    fontFamily: font.display,
    fontSize: type.xl,
    color: colors.brandPrimary,
    letterSpacing: 2,
  },
  titleBig: {
    fontFamily: font.display,
    fontSize: type["4xl"],
    color: "#FFFFFF",
    lineHeight: type["4xl"] + 4,
  },
  tagline: {
    fontFamily: font.text,
    fontSize: type.lg,
    color: "#FFFFFF",
    marginTop: spacing.xs,
  },
  menu: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    justifyContent: "center",
  },
  secondaryRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  smallBtn: {
    flex: 1,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  smallBtnText: { fontFamily: font.display, fontSize: type.sm, color: colors.onSurface },
});
