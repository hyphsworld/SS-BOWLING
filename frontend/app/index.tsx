import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
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
        <LinearGradient
          colors={["#17121F", "#38204F", "#FF2D55", colors.surface]}
          locations={[0, 0.5, 0.82, 1]}
          style={StyleSheet.absoluteFill}
        />
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

        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>AMS WEST</Text>
        </View>

        <Animated.View
          entering={FadeInDown.duration(500)}
          style={styles.titleWrap}
        >
          <Text style={styles.titleSmall}>SUPER</Text>
          <Text style={styles.titleBig}>STRIKE</Text>
          <Text style={styles.tagline}>Power up. Knock {"'"}em all down.</Text>
        </Animated.View>
      </View>

      <View style={[styles.menu, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Animated.View entering={FadeInDown.delay(100)}>
          <PrimaryButton
            testID="mode-solo-button"
            label="Solo Play"
            icon="game-controller"
            variant="primary"
            onPress={() => router.push("/game?mode=solo")}
          />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(180)}>
          <PrimaryButton
            testID="mode-cpu-button"
            label="Vs CPU"
            icon="hardware-chip"
            variant="dark"
            onPress={() => router.push("/game?mode=cpu")}
          />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(260)}>
          <PrimaryButton
            testID="mode-multiplayer-button"
            label="Multiplayer"
            icon="people"
            variant="secondary"
            onPress={() => router.push("/multiplayer")}
          />
        </Animated.View>
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
const heroHeight = Math.min(360, Math.max(260, height * 0.38));

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  heroWrap: { height: heroHeight, overflow: "hidden" },
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
  titleWrap: {
    position: "absolute",
    bottom: spacing.lg,
    left: spacing.xl,
  },
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
    paddingTop: spacing.lg,
    gap: spacing.md,
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
