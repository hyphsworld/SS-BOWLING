import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors, font, radius, spacing, type, shadow } from "@/src/theme/theme";
import { api } from "@/src/api/client";

interface Row {
  id: string;
  name: string;
  score: number;
  mode: string;
  strikes: number;
}

const MEDALS = ["#FFD60A", "#C7C7CC", "#CD7F32"];

export default function Leaderboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.leaderboard(30);
      setRows(data);
    } catch (e) {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="lb-back-button" onPress={() => router.replace("/")} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Leaderboard</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          testID="leaderboard-list"
          data={rows}
          keyExtractor={(item, i) => item.id || String(i)}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing.sm,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.brandPrimary}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="trophy-outline" size={54} color={colors.border} />
              <Text style={styles.emptyText}>No scores yet. Be the first!</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <View
                style={[
                  styles.rank,
                  index < 3 && { backgroundColor: MEDALS[index] },
                ]}
              >
                <Text style={[styles.rankText, index < 3 && { color: colors.onSurface }]}>
                  {index + 1}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.meta}>
                  {item.mode.toUpperCase()} · {item.strikes} strikes
                </Text>
              </View>
              <Text style={styles.score}>{item.score}</Text>
            </View>
          )}
        />
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: spacing["3xl"], gap: spacing.md },
  emptyText: { fontFamily: font.text, fontSize: type.lg, color: colors.onSurfaceSecondary },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.card,
  },
  rank: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { fontFamily: font.display, fontSize: type.lg, color: colors.onSurface },
  name: { fontFamily: font.display, fontSize: type.lg, color: colors.onSurface },
  meta: { fontFamily: font.text, fontSize: type.sm, color: colors.onSurfaceSecondary },
  score: { fontFamily: font.display, fontSize: type["2xl"], color: colors.brandPrimary },
});
