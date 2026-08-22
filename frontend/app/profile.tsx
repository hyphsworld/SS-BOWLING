import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import PrimaryButton from "@/src/components/PrimaryButton";
import { colors, font, radius, spacing, type, shadow } from "@/src/theme/theme";
import { api } from "@/src/api/client";
import { ensurePlayer, setName as saveName } from "@/src/store/player";

interface Stats {
  games: number;
  best: number;
  average: number;
  total_strikes: number;
  wins: number;
}

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setNameState] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await ensurePlayer();
      setNameState(p.name);
      try {
        const s = await api.getStats(p.id);
        setStats(s);
      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    await saveName(name);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const cards = [
    { label: "Games", value: stats?.games ?? 0, icon: "game-controller", color: colors.onSurface },
    { label: "Best Score", value: stats?.best ?? 0, icon: "trophy", color: colors.brand },
    { label: "Average", value: stats?.average ?? 0, icon: "bar-chart", color: colors.brandSecondary },
    { label: "Strikes", value: stats?.total_strikes ?? 0, icon: "flame", color: colors.brandPrimary },
    { label: "Wins", value: stats?.wins ?? 0, icon: "ribbon", color: colors.brandSecondary },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="profile-back-button" onPress={() => router.replace("/")} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>My Stats</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.avatarBox}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color={colors.onSurfaceInverse} />
            </View>
          </View>

          <Text style={styles.fieldLabel}>YOUR NAME</Text>
          <View style={styles.nameRow}>
            <TextInput
              testID="name-input"
              value={name}
              onChangeText={setNameState}
              style={styles.input}
              placeholder="Enter name"
              placeholderTextColor={colors.onSurfaceSecondary}
              maxLength={16}
            />
            <PrimaryButton
              testID="save-name-button"
              label={saved ? "Saved!" : "Save"}
              variant="dark"
              size="md"
              onPress={handleSave}
            />
          </View>

          <View style={styles.grid}>
            {cards.map((c) => (
              <View key={c.label} style={styles.statCard}>
                <Ionicons name={c.icon as any} size={22} color={c.color} />
                <Text style={styles.statValue}>{c.value}</Text>
                <Text style={styles.statLabel}>{c.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  title: { fontFamily: font.display, fontSize: type["2xl"], color: colors.onSurface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, padding: spacing.lg, gap: spacing.md },
  avatarBox: { alignItems: "center", marginVertical: spacing.md },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  fieldLabel: { fontFamily: font.display, fontSize: type.sm, color: colors.onSurfaceSecondary, letterSpacing: 1 },
  nameRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  input: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
    fontFamily: font.display,
    fontSize: type.lg,
    color: colors.onSurface,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  statCard: {
    width: "47%",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadow.card,
  },
  statValue: { fontFamily: font.display, fontSize: type["3xl"], color: colors.onSurface },
  statLabel: { fontFamily: font.text, fontSize: type.base, color: colors.onSurfaceSecondary },
});
