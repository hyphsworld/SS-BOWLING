import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import PrimaryButton from "@/src/components/PrimaryButton";
import { colors, font, radius, spacing, type, shadow } from "@/src/theme/theme";
import { api, Room } from "@/src/api/client";
import { ensurePlayer } from "@/src/store/player";

type View_ = "menu" | "hosting" | "joining";

export default function Multiplayer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<View_>("menu");
  const [codeInput, setCodeInput] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const identity = useRef<{ id: string; name: string }>({ id: "", name: "You" });
  const started = useRef(false);

  useEffect(() => {
    ensurePlayer().then((p) => (identity.current = p)).catch(() => {});
  }, []);

  // poll room when hosting / joining
  useEffect(() => {
    if (view === "menu" || !room) return;
    const iv = setInterval(async () => {
      try {
        const r = await api.getRoom(room.code);
        setRoom(r);
        if (r.players.length >= 2 && !started.current) {
          started.current = true;
          clearInterval(iv);
          router.replace(`/game?mode=multiplayer&code=${r.code}`);
        }
      } catch (e) {}
    }, 2000);
    return () => clearInterval(iv);
  }, [view, room?.code]);

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api.createRoom(identity.current.id, identity.current.name);
      setRoom(r);
      setView("hosting");
    } catch (e: any) {
      setError("Could not create room. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (codeInput.trim().length < 4) {
      setError("Enter the 4-character room code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await api.joinRoom(codeInput.trim(), identity.current.id, identity.current.name);
      setRoom(r);
      setView("joining");
      if (r.players.length >= 2 && !started.current) {
        started.current = true;
        router.replace(`/game?mode=multiplayer&code=${r.code}`);
      }
    } catch (e: any) {
      setError("Room not found or full.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          testID="mp-back-button"
          onPress={() => router.replace("/")}
          style={styles.iconBtn}
        >
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Multiplayer</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.body}>
        {view === "menu" && (
          <Animated.View entering={FadeIn} style={{ gap: spacing.xl }}>
            <View style={styles.hero}>
              <Ionicons name="people" size={54} color={colors.brandPrimary} />
              <Text style={styles.heroText}>
                Challenge a friend to a 10-frame score battle. First, create a room and
                share the code — or join one.
              </Text>
            </View>

            <PrimaryButton
              testID="create-room-button"
              label="Create Room"
              icon="add-circle"
              variant="primary"
              loading={loading}
              onPress={handleCreate}
            />

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>OR JOIN</Text>
              <View style={styles.line} />
            </View>

            <View style={styles.joinRow}>
              <TextInput
                testID="room-code-input"
                value={codeInput}
                onChangeText={(t) => setCodeInput(t.toUpperCase().slice(0, 4))}
                placeholder="CODE"
                placeholderTextColor={colors.onSurfaceSecondary}
                autoCapitalize="characters"
                style={styles.codeInput}
                maxLength={4}
              />
              <PrimaryButton
                testID="join-room-button"
                label="Join"
                variant="secondary"
                size="lg"
                loading={loading}
                onPress={handleJoin}
                style={{ flex: 1 }}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Animated.View>
        )}

        {(view === "hosting" || view === "joining") && room && (
          <Animated.View entering={FadeInDown} style={styles.waitCard}>
            <Text style={styles.waitLabel}>ROOM CODE</Text>
            <Text testID="room-code-display" style={styles.code}>
              {room.code}
            </Text>
            <Text style={styles.shareHint}>Share this code with your friend</Text>

            <View style={styles.playersBox}>
              {room.players.map((p) => (
                <View key={p.id} style={styles.playerRow}>
                  <Ionicons
                    name={p.id === identity.current.id ? "person-circle" : "person"}
                    size={22}
                    color={colors.onSurface}
                  />
                  <Text style={styles.playerName}>
                    {p.name}
                    {p.id === identity.current.id ? " (you)" : ""}
                  </Text>
                  {p.is_host && <Text style={styles.hostTag}>HOST</Text>}
                </View>
              ))}
              {room.players.length < 2 && (
                <View style={styles.playerRow}>
                  <ActivityIndicator color={colors.brandPrimary} />
                  <Text style={styles.waitingText}>Waiting for opponent…</Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}
      </View>
    </KeyboardAvoidingView>
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
  body: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  hero: { alignItems: "center", gap: spacing.md },
  heroText: {
    fontFamily: font.text,
    fontSize: type.lg,
    color: colors.onSurfaceSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  line: { flex: 1, height: 1.5, backgroundColor: colors.border },
  dividerText: { fontFamily: font.display, fontSize: type.sm, color: colors.onSurfaceSecondary },
  joinRow: { flexDirection: "row", gap: spacing.md },
  codeInput: {
    width: 130,
    height: 58,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSecondary,
    fontFamily: font.display,
    fontSize: type["2xl"],
    letterSpacing: 4,
    textAlign: "center",
    color: colors.onSurface,
  },
  error: { fontFamily: font.text, fontSize: type.base, color: colors.error, textAlign: "center" },
  waitCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    ...shadow.card,
  },
  waitLabel: { fontFamily: font.display, fontSize: type.base, color: colors.onSurfaceSecondary, letterSpacing: 2 },
  code: {
    fontFamily: font.display,
    fontSize: 64,
    color: colors.brandPrimary,
    letterSpacing: 8,
  },
  shareHint: { fontFamily: font.text, fontSize: type.base, color: colors.onSurfaceSecondary },
  playersBox: { width: "100%", marginTop: spacing.lg, gap: spacing.sm },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  playerName: { fontFamily: font.display, fontSize: type.lg, color: colors.onSurface, flex: 1 },
  hostTag: { fontFamily: font.display, fontSize: type.sm, color: colors.brandSecondary },
  waitingText: { fontFamily: font.text, fontSize: type.base, color: colors.onSurfaceSecondary },
});
