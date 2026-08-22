import React, { useEffect, useRef, useState, useReducer, useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import BowlingLane, { ThrowState } from "@/src/components/BowlingLane";
import Scorecard from "@/src/components/Scorecard";
import PowerUpTray from "@/src/components/PowerUpTray";
import TimingMeters from "@/src/components/TimingMeters";
import Glass from "@/src/components/Glass";
import { colors, font, radius, spacing, type, shadow } from "@/src/theme/theme";
import { POWERUPS, PowerUpId } from "@/src/game/powerups";
import {
  newGame,
  applyThrow,
  scoreGame,
  countStrikes,
  countSpares,
  ThrowResult,
} from "@/src/game/engine";
import { api } from "@/src/api/client";
import { ensurePlayer } from "@/src/store/player";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Phase = "aim" | "power" | "rolling" | "cpu" | "over";
type Owner = "me" | "opp";

interface Pending {
  owner: Owner;
  aim: number;
  power: number;
  pu: PowerUpId | null;
}

export default function Game() {
  const params = useLocalSearchParams<{ mode?: string; code?: string; oppName?: string }>();
  const mode = (params.mode as "solo" | "cpu" | "multiplayer") || "solo";
  const code = params.code || "";
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const meRef = useRef(newGame());
  const oppRef = useRef(newGame());
  const [, force] = useReducer((x) => x + 1, 0);

  const [phase, setPhase] = useState<Phase>("aim");
  const [active, setActive] = useState<Owner>("me");
  const [armed, setArmed] = useState<PowerUpId | null>(null);
  const [throwState, setThrowState] = useState<ThrowState | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [oppRemote, setOppRemote] = useState<{
    name: string;
    score: number;
    finished: boolean;
  } | null>(null);

  const armedAim = useRef(0);
  const throwKey = useRef(0);
  const pending = useRef<Pending | null>(null);
  const arriveResolver = useRef<null | (() => void)>(null);

  const identity = useRef<{ id: string; name: string }>({ id: "", name: "You" });
  const routed = useRef(false);

  useEffect(() => {
    ensurePlayer()
      .then((p) => {
        identity.current = p;
      })
      .catch(() => {});
  }, []);

  const activeGame = active === "me" ? meRef.current : oppRef.current;

  // ---------- Banner ----------
  const showBanner = (res: ThrowResult) => {
    let text: string | null = null;
    if (res.isStrike) text = "STRIKE!";
    else if (res.isSpare) text = "SPARE!";
    else if (res.knockedCount === 0) text = "GUTTER";
    if (text) {
      setBanner(text);
      if (res.isStrike)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => setBanner(null), 1100);
    }
  };

  // ---------- Multiplayer progress ----------
  const postProgress = useCallback(
    async (finished: boolean) => {
      if (mode !== "multiplayer" || !code) return;
      const score = scoreGame(meRef.current.frames).total;
      try {
        const room = await api.updateProgress(code, {
          player_id: identity.current.id,
          name: identity.current.name,
          score,
          current_frame: meRef.current.currentFrame,
          finished,
        });
        const opp = room.players.find((p) => p.id !== identity.current.id);
        if (opp) setOppRemote({ name: opp.name, score: opp.score, finished: opp.finished });
        if (room.status === "finished" && meRef.current.done) finishMultiplayer(room.winner);
      } catch (e) {}
    },
    [mode, code],
  );

  // Poll opponent in multiplayer
  useEffect(() => {
    if (mode !== "multiplayer" || !code) return;
    const iv = setInterval(async () => {
      try {
        const room = await api.getRoom(code);
        const opp = room.players.find((p) => p.id !== identity.current.id);
        if (opp) setOppRemote({ name: opp.name, score: opp.score, finished: opp.finished });
        if (room.status === "finished" && meRef.current.done) finishMultiplayer(room.winner);
      } catch (e) {}
    }, 2500);
    return () => clearInterval(iv);
  }, [mode, code]);

  // ---------- Throw resolution ----------
  const onArrive = () => {
    const p = pending.current;
    if (!p) return;
    const g = p.owner === "me" ? meRef.current : oppRef.current;
    const res = applyThrow(g, p.aim, p.power, p.pu);
    pending.current = null;
    setArmed(null);
    showBanner(res);
    force();
    if (p.owner === "me") {
      setTimeout(() => afterPlayerThrow(res), 950);
    }
    if (arriveResolver.current) {
      const r = arriveResolver.current;
      arriveResolver.current = null;
      setTimeout(r, 950);
    }
  };

  const triggerThrow = (owner: Owner, aim: number, power: number, pu: PowerUpId | null) => {
    throwKey.current += 1;
    pending.current = { owner, aim, power, pu };
    setThrowState({ key: throwKey.current, aim, powerup: pu });
  };

  // Player controls
  const onLockAim = (aim: number) => {
    armedAim.current = aim;
    setPhase("power");
  };
  const onLockPower = (power: number) => {
    setPhase("rolling");
    triggerThrow("me", armedAim.current, power, armed);
  };

  const resetNext = () => {
    setActive("me");
    setPhase("aim");
  };

  const afterPlayerThrow = (res: ThrowResult) => {
    if (mode === "multiplayer") {
      postProgress(meRef.current.done);
      if (meRef.current.done) {
        setPhase("over");
        return;
      }
      resetNext();
      return;
    }
    if (mode === "cpu") {
      if (res.frameEnded) {
        startCpuTurn();
        return;
      }
      resetNext();
      return;
    }
    // solo
    if (meRef.current.done) {
      finishSolo();
      return;
    }
    resetNext();
  };

  // CPU turn
  const cpuThrow = (aim: number, power: number, pu: PowerUpId | null) =>
    new Promise<void>((resolve) => {
      arriveResolver.current = resolve;
      triggerThrow("opp", aim, power, pu);
    });

  const startCpuTurn = async () => {
    setActive("opp");
    setPhase("cpu");
    const g = oppRef.current;
    const startFrame = g.currentFrame;
    await delay(650);
    let guard = 0;
    while (!g.done && g.currentFrame === startFrame && guard < 6) {
      guard += 1;
      const aim = 0.175 + (Math.random() - 0.5) * 0.42;
      const power = 0.58 + Math.random() * 0.34;
      let pu: PowerUpId | null = null;
      const affordable = POWERUPS.filter((p) => g.energy >= p.cost);
      if (affordable.length && Math.random() < 0.45) {
        pu = affordable[Math.floor(Math.random() * affordable.length)].id;
      }
      await cpuThrow(aim, power, pu);
      await delay(550);
    }
    if (g.done && meRef.current.done) {
      finishVsCpu();
      return;
    }
    resetNext();
  };

  // ---------- Finish handlers ----------
  const finishSolo = () => {
    if (routed.current) return;
    routed.current = true;
    const total = scoreGame(meRef.current.frames).total;
    router.replace({
      pathname: "/results",
      params: {
        mode: "solo",
        myScore: String(total),
        strikes: String(countStrikes(meRef.current.frames)),
        spares: String(countSpares(meRef.current.frames)),
      },
    });
  };

  const finishVsCpu = () => {
    if (routed.current) return;
    routed.current = true;
    const my = scoreGame(meRef.current.frames).total;
    const opp = scoreGame(oppRef.current.frames).total;
    const result = my > opp ? "win" : my < opp ? "lose" : "tie";
    router.replace({
      pathname: "/results",
      params: {
        mode: "cpu",
        myScore: String(my),
        oppScore: String(opp),
        oppName: "CPU",
        result,
        strikes: String(countStrikes(meRef.current.frames)),
        spares: String(countSpares(meRef.current.frames)),
      },
    });
  };

  const finishMultiplayer = (winner: string | null) => {
    if (routed.current) return;
    routed.current = true;
    const my = scoreGame(meRef.current.frames).total;
    let result = "tie";
    if (winner === "tie") result = "tie";
    else if (winner === identity.current.id) result = "win";
    else if (winner) result = "lose";
    router.replace({
      pathname: "/results",
      params: {
        mode: "multiplayer",
        myScore: String(my),
        oppScore: String(oppRemote?.score ?? 0),
        oppName: oppRemote?.name ?? "Opponent",
        result,
        strikes: String(countStrikes(meRef.current.frames)),
        spares: String(countSpares(meRef.current.frames)),
      },
    });
  };

  // ---------- Derived ----------
  const myTotal = scoreGame(meRef.current.frames).total;
  const oppTotal =
    mode === "cpu"
      ? scoreGame(oppRef.current.frames).total
      : oppRemote?.score ?? 0;
  const activeTotal = scoreGame(activeGame.frames).total;
  const displayFrame = Math.min(activeGame.currentFrame + 1, 10);
  const isMyTurn = active === "me" && (phase === "aim" || phase === "power");

  const showOpp = mode === "cpu" || mode === "multiplayer";

  return (
    <View style={styles.container}>
      {/* Lane */}
      <BowlingLane
        standing={activeGame.standing}
        throwState={throwState}
        onArrive={onArrive}
      />

      {/* Top HUD */}
      <View style={[styles.topHud, { top: insets.top + spacing.xs }]}>
        <View style={styles.topRow}>
          <Pressable
            testID="quit-game-button"
            onPress={() => router.replace("/")}
            style={styles.iconBtn}
          >
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </Pressable>
          <View style={styles.scorePills}>
            <View
              style={[
                styles.scorePill,
                active === "me" && styles.scorePillActive,
              ]}
            >
              <Text style={styles.scorePillLabel}>YOU</Text>
              <Text style={styles.scorePillValue}>{myTotal}</Text>
            </View>
            {showOpp && (
              <View
                style={[
                  styles.scorePill,
                  styles.scorePillOpp,
                  active === "opp" && styles.scorePillActive,
                ]}
              >
                <Text style={styles.scorePillLabel}>
                  {mode === "cpu" ? "CPU" : oppRemote?.name?.slice(0, 6) ?? "OPP"}
                </Text>
                <Text style={styles.scorePillValue}>{oppTotal}</Text>
              </View>
            )}
          </View>
          <View style={styles.frameBadge}>
            <Text style={styles.frameBadgeText}>F{displayFrame}</Text>
          </View>
        </View>
        <Glass style={styles.scorecardGlass} intensity={30}>
          <Scorecard
            frames={activeGame.frames}
            currentFrame={activeGame.currentFrame}
            testID="scorecard"
          />
        </Glass>
      </View>

      {/* Turn / status banner */}
      {banner && (
        <Animated.View
          entering={ZoomIn.duration(220)}
          style={styles.bannerWrap}
          pointerEvents="none"
        >
          <Text
            style={[
              styles.bannerText,
              banner === "GUTTER" && { color: colors.onSurfaceInverse },
            ]}
          >
            {banner}
          </Text>
        </Animated.View>
      )}

      {/* Bottom controls */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Glass style={styles.controlPanel} intensity={45}>
          <View style={styles.panelInner}>
            {phase === "cpu" && (
              <Animated.View entering={FadeIn} style={styles.statusRow}>
                <Ionicons name="hardware-chip" size={20} color={colors.brandPrimary} />
                <Text style={styles.statusText}>CPU is bowling…</Text>
              </Animated.View>
            )}
            {phase === "rolling" && (
              <View style={styles.statusRow}>
                <Ionicons name="disc" size={20} color={colors.onSurface} />
                <Text style={styles.statusText}>Rolling…</Text>
              </View>
            )}
            {phase === "over" && (
              <View style={styles.statusRow}>
                <Ionicons name="hourglass" size={20} color={colors.brandPrimary} />
                <Text style={styles.statusText}>
                  Waiting for {oppRemote?.name ?? "opponent"} to finish…
                </Text>
              </View>
            )}

            {isMyTurn && (
              <>
                <PowerUpTray
                  energy={meRef.current.energy}
                  armed={armed}
                  onArm={setArmed}
                  disabled={phase !== "aim"}
                />
                <TimingMeters
                  phase={phase === "aim" ? "aim" : phase === "power" ? "power" : "idle"}
                  onLockAim={onLockAim}
                  onLockPower={onLockPower}
                />
              </>
            )}
          </View>
        </Glass>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  topHud: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    gap: spacing.sm,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  scorePills: { flex: 1, flexDirection: "row", gap: spacing.sm, justifyContent: "center" },
  scorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 38,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadow.card,
  },
  scorePillOpp: {},
  scorePillActive: { borderColor: colors.brandPrimary },
  scorePillLabel: { fontFamily: font.display, fontSize: type.sm, color: colors.onSurfaceSecondary },
  scorePillValue: { fontFamily: font.display, fontSize: type.xl, color: colors.onSurface },
  frameBadge: {
    width: 42,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceInverse,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  frameBadgeText: { fontFamily: font.display, fontSize: type.base, color: colors.onSurfaceInverse },
  scorecardGlass: { paddingVertical: spacing.xs, paddingHorizontal: spacing.xs },
  bannerWrap: {
    position: "absolute",
    top: "34%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  bannerText: {
    fontFamily: font.display,
    fontSize: type["4xl"],
    color: colors.brandPrimary,
    textShadowColor: "rgba(0,0,0,0.15)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  bottom: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: 0,
  },
  controlPanel: { borderRadius: radius.lg },
  panelInner: { padding: spacing.md, gap: spacing.md },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  statusText: { fontFamily: font.display, fontSize: type.lg, color: colors.onSurface },
});
