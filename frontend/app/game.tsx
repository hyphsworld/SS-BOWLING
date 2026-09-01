import React, { useEffect, useRef, useState, useReducer, useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";

import BowlingLane, { ThrowState } from "@/src/components/BowlingLane";
import Scorecard from "@/src/components/Scorecard";
import PowerUpTray from "@/src/components/PowerUpTray";
import TimingMeters from "@/src/components/TimingMeters";
import Glass from "@/src/components/Glass";
import Celebration from "@/src/components/Celebration";
import SoundToggle from "@/src/components/SoundToggle";
import { colors, font, radius, spacing, type, shadow } from "@/src/theme/theme";
import { POWERUPS, PowerUpId } from "@/src/game/powerups";
import {
  newGame,
  applyThrow,
  applyGutterThrow,
  scoreGame,
  countStrikes,
  countSpares,
  ThrowResult,
} from "@/src/game/engine";
import { api } from "@/src/api/client";
import { ensurePlayer } from "@/src/store/player";
import { playSound, stopSound } from "@/src/audio/sounds";
import { getRival, Rival } from "@/src/store/rival";
import { getSelectedSkin } from "@/src/game/skins";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const FRAME_BREAK_MS = 2600;

type Phase = "aim" | "power" | "rolling" | "intermission" | "cpu" | "over";
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
  const [knockdown, setKnockdown] = useState<{ key: number; pins: number[] } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [oppRemote, setOppRemote] = useState<{ name: string; score: number; finished: boolean } | null>(null);
  const [quip, setQuip] = useState<{ text: string; voice: "commentator" | "cpu" } | null>(null);
  const [intermissionText, setIntermissionText] = useState<string | null>(null);
  const quipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intermissionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEvent = useRef<"strike" | "spare" | "gutter" | "open">("open");

  const armedAim = useRef(0);
  const throwKey = useRef(0);
  const pending = useRef<Pending | null>(null);
  const arriveResolver = useRef<null | (() => void)>(null);

  const identity = useRef<{ id: string; name: string }>({ id: "", name: "You" });
  const routed = useRef(false);
  const rivalRef = useRef<Rival | null>(null);
  const [rivalName, setRivalName] = useState("CPU");
  const [ballSkin, setBallSkin] = useState("classic");

  useEffect(() => {
    ensurePlayer().then((p) => { identity.current = p; }).catch(() => {});
    getSelectedSkin().then(setBallSkin);
    if (mode === "cpu") {
      getRival().then((r) => { rivalRef.current = r; setRivalName(r.name); });
    }
  }, []);

  const activeGame = active === "me" ? meRef.current : oppRef.current;

  const showQuip = useCallback((voice: "commentator" | "cpu", event: "strike" | "spare" | "gutter" | "open", knocked: number) => {
    const r = rivalRef.current;
    api.aiQuip({ voice, event, knocked, frame: meRef.current.currentFrame + 1, opp_name: identity.current.name, rival_name: voice === "cpu" ? r?.name : undefined, cpu_wins: voice === "cpu" ? r?.cpuWins ?? 0 : undefined, player_wins: voice === "cpu" ? r?.playerWins ?? 0 : undefined, last_result: voice === "cpu" ? r?.lastResult ?? undefined : undefined }).then((res) => {
      if (!res?.text) return;
      setQuip({ text: res.text, voice });
      if (quipTimer.current) clearTimeout(quipTimer.current);
      quipTimer.current = setTimeout(() => setQuip(null), 4200);
    }).catch(() => {});
  }, []);

  useEffect(() => () => {
    if (quipTimer.current) clearTimeout(quipTimer.current);
    if (intermissionTimer.current) clearTimeout(intermissionTimer.current);
  }, []);

  const showBanner = (res: ThrowResult) => {
    let text: string | null = null;
    if (res.isStrike) text = "STRIKE!";
    else if (res.isSpare) text = "SPARE!";
    else if (res.knockedCount === 0) text = "GUTTER";
    if (text) {
      setBanner(text);
      if (res.isStrike) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => setBanner(null), 1100);
    }
  };

  const postProgress = useCallback(async (finished: boolean) => {
    if (mode !== "multiplayer" || !code) return;
    const score = scoreGame(meRef.current.frames).total;
    try {
      const room = await api.updateProgress(code, { player_id: identity.current.id, name: identity.current.name, score, current_frame: meRef.current.currentFrame, finished });
      const opp = room.players.find((p) => p.id !== identity.current.id);
      if (opp) setOppRemote({ name: opp.name, score: opp.score, finished: opp.finished });
      if (room.status === "finished" && meRef.current.done) finishMultiplayer(room.winner);
    } catch (e) {}
  }, [mode, code]);

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

  const beginIntermission = (res: ThrowResult) => {
    setPhase("intermission");
    const nextFrame = Math.min(meRef.current.currentFrame + 1, 10);
    setIntermissionText(res.isStrike ? `STRIKE! • FRAME ${nextFrame} NEXT` : res.isSpare ? `SPARE! • FRAME ${nextFrame} NEXT` : res.knockedCount === 0 ? `GUTTER • FRAME ${nextFrame} NEXT` : `FRAME ${nextFrame} NEXT`);
    if (intermissionTimer.current) clearTimeout(intermissionTimer.current);
    intermissionTimer.current = setTimeout(() => { setIntermissionText(null); afterPlayerThrow(res); }, FRAME_BREAK_MS);
  };

  const finishResolvedThrow = (res: ThrowResult, owner: Owner) => {
    showBanner(res);
    force();
    if (owner === "me") {
      const event = res.isStrike ? "strike" : res.isSpare ? "spare" : res.knockedCount === 0 ? "gutter" : "open";
      lastEvent.current = event;
      if (event !== "open") showQuip("commentator", event, res.knockedCount);
      if (res.frameEnded && !meRef.current.done) beginIntermission(res);
      else setTimeout(() => afterPlayerThrow(res), 950);
    }
    if (arriveResolver.current) {
      const r = arriveResolver.current;
      arriveResolver.current = null;
      setTimeout(r, res.frameEnded ? FRAME_BREAK_MS : 950);
    }
  };

  const onArrive = () => {
    const p = pending.current;
    if (!p) return;
    const g = p.owner === "me" ? meRef.current : oppRef.current;
    const res = applyThrow(g, p.aim, p.power, p.pu);
    pending.current = null;
    setArmed(null);
    setKnockdown({ key: throwKey.current, pins: res.knocked });
    stopSound("ball_roll");

    // Audio now follows the physical result event: one pin impact sound at arrival.
    // No delayed pin knock or strike/spare stinger to drift behind the animation.
    if (res.knockedCount > 0) playSound("pin_crash");
    else playSound("gutter");

    finishResolvedThrow(res, p.owner);
  };

  const onHazardBlocked = () => {
    const p = pending.current;
    if (!p) return;
    const g = p.owner === "me" ? meRef.current : oppRef.current;
    const res = applyGutterThrow(g, p.pu);
    pending.current = null;
    setArmed(null);
    setKnockdown({ key: throwKey.current, pins: [] });
    stopSound("ball_roll");
    playSound("gutter");
    finishResolvedThrow(res, p.owner);
  };

  const triggerThrow = (owner: Owner, aim: number, power: number, pu: PowerUpId | null) => {
    throwKey.current += 1;
    pending.current = { owner, aim, power, pu };
    if (pu) playSound("powerup");
    playSound("ball_roll");
    setThrowState({ key: throwKey.current, aim, powerup: pu });
  };

  const onLockAim = (aim: number) => { armedAim.current = aim; setPhase("power"); };
  const onLockPower = (power: number) => { setPhase("rolling"); triggerThrow("me", armedAim.current, power, armed); };
  const resetNext = () => { setActive("me"); setPhase("aim"); };

  const afterPlayerThrow = (res: ThrowResult) => {
    if (mode === "multiplayer") { postProgress(meRef.current.done); if (meRef.current.done) { setPhase("over"); return; } resetNext(); return; }
    if (mode === "cpu") { if (res.frameEnded) { startCpuTurn(); return; } resetNext(); return; }
    if (meRef.current.done) { finishSolo(); return; }
    resetNext();
  };

  const cpuThrow = (aim: number, power: number, pu: PowerUpId | null) => new Promise<void>((resolve) => { arriveResolver.current = resolve; triggerThrow("opp", aim, power, pu); });

  const startCpuTurn = async () => {
    setActive("opp"); setPhase("cpu"); showQuip("cpu", lastEvent.current, 0);
    const g = oppRef.current; const startFrame = g.currentFrame; await delay(650); let guard = 0;
    while (!g.done && g.currentFrame === startFrame && guard < 6) {
      guard += 1; const aim = 0.175 + (Math.random() - 0.5) * 0.42; const power = 0.58 + Math.random() * 0.34; let pu: PowerUpId | null = null;
      const affordable = POWERUPS.filter((p) => g.energy >= p.cost); if (affordable.length && Math.random() < 0.45) pu = affordable[Math.floor(Math.random() * affordable.length)].id;
      await cpuThrow(aim, power, pu); await delay(550);
    }
    if (g.done && meRef.current.done) { finishVsCpu(); return; } resetNext();
  };

  const finishSolo = () => {
    if (routed.current) return; routed.current = true; const total = scoreGame(meRef.current.frames).total;
    router.replace({ pathname: "/results", params: { mode: "solo", myScore: String(total), strikes: String(countStrikes(meRef.current.frames)), spares: String(countSpares(meRef.current.frames)) } });
  };
  const finishVsCpu = () => {
    if (routed.current) return; routed.current = true; const my = scoreGame(meRef.current.frames).total; const opp = scoreGame(oppRef.current.frames).total; const result = my > opp ? "win" : my < opp ? "lose" : "tie";
    router.replace({ pathname: "/results", params: { mode: "cpu", myScore: String(my), oppScore: String(opp), oppName: rivalName, result, strikes: String(countStrikes(meRef.current.frames)), spares: String(countSpares(meRef.current.frames)) } });
  };
  const finishMultiplayer = (winner: string | null) => {
    if (routed.current) return; routed.current = true; const my = scoreGame(meRef.current.frames).total; let result = "tie"; if (winner === "tie") result = "tie"; else if (winner === identity.current.id) result = "win"; else if (winner) result = "lose";
    router.replace({ pathname: "/results", params: { mode: "multiplayer", myScore: String(my), oppScore: String(oppRemote?.score ?? 0), oppName: oppRemote?.name ?? "Opponent", result, strikes: String(countStrikes(meRef.current.frames)), spares: String(countSpares(meRef.current.frames)) } });
  };

  const myTotal = scoreGame(meRef.current.frames).total;
  const oppTotal = mode === "cpu" ? scoreGame(oppRef.current.frames).total : oppRemote?.score ?? 0;
  const displayFrame = Math.min(activeGame.currentFrame + 1, 10);
  const isMyTurn = active === "me" && (phase === "aim" || phase === "power");
  const showOpp = mode === "cpu" || mode === "multiplayer";

  return (
    <View style={styles.container}>
      <BowlingLane standing={activeGame.standing} throwState={throwState} knockdown={knockdown} ballSkin={ballSkin} onArrive={onArrive} onHazardBlocked={onHazardBlocked} />
      <View style={[styles.topHud, { top: insets.top + spacing.xs }]}>
        <View style={styles.topRow}>
          <Pressable testID="quit-game-button" onPress={() => router.replace("/")} style={styles.iconBtn}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
          <View style={styles.scorePill}><Text style={styles.scoreLabel}>SCORE</Text><Text style={styles.scoreValue}>{myTotal}</Text></View>
          {showOpp && <View style={styles.oppPill}><Text style={styles.oppName}>{mode === "cpu" ? rivalName : oppRemote?.name ?? "OPP"}</Text><Text style={styles.oppScore}>{oppTotal}</Text></View>}
          <View style={styles.framePill}><Text style={styles.frameLabel}>FRAME</Text><Text style={styles.frameValue}>{displayFrame}/10</Text></View>
          <SoundToggle />
        </View>
        <Scorecard frames={meRef.current.frames} activeFrame={meRef.current.currentFrame} compact />
      </View>
      {quip && <View style={[styles.quip, { top: insets.top + 122 }]}><Text style={styles.quipLabel}>{quip.voice === "cpu" ? rivalName.toUpperCase() : "COMMENTATOR"}</Text><Text style={styles.quipText}>{quip.text}</Text></View>}
      {phase === "intermission" && intermissionText && <View style={styles.intermission}><Text style={styles.intermissionText}>{intermissionText}</Text></View>}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.sm }]}>
        <PowerUpTray energy={activeGame.energy} armed={armed} onArm={isMyTurn && phase === "aim" ? setArmed : () => {}} />
        {isMyTurn ? <TimingMeters phase={phase as "aim" | "power"} onLockAim={onLockAim} onLockPower={onLockPower} /> : <Glass style={styles.waitBox}><Text style={styles.waitText}>{phase === "cpu" ? `${rivalName} BOWLING…` : phase === "intermission" ? "RESETTING LANE…" : "BALL IN MOTION…"}</Text></Glass>}
      </View>
      {banner && <Animated.View entering={FadeIn.duration(100)} style={styles.banner}><Text style={styles.bannerText}>{banner}</Text></Animated.View>}
      <Celebration event={banner === "STRIKE!" ? "strike" : banner === "SPARE!" ? "spare" : null} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topHud: { position: "absolute", left: spacing.sm, right: spacing.sm, gap: spacing.xs },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  iconBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(10,14,30,0.82)", borderWidth: 1, borderColor: colors.glassBorder, alignItems: "center", justifyContent: "center" },
  scorePill: { flexDirection: "row", alignItems: "baseline", gap: 6, paddingHorizontal: 12, height: 42, borderRadius: 14, backgroundColor: "rgba(10,14,30,0.86)", borderWidth: 1, borderColor: colors.cyan, justifyContent: "center" },
  scoreLabel: { color: colors.muted, fontSize: 9, fontFamily: font.bold, letterSpacing: 1 }, scoreValue: { color: colors.cyan, fontSize: 22, fontFamily: font.heavy },
  framePill: { paddingHorizontal: 10, height: 42, borderRadius: 14, backgroundColor: "rgba(10,14,30,0.86)", borderWidth: 1, borderColor: colors.glassBorder, alignItems: "center", justifyContent: "center" }, frameLabel: { color: colors.muted, fontSize: 8, fontFamily: font.bold }, frameValue: { color: colors.text, fontSize: 14, fontFamily: font.heavy },
  oppPill: { paddingHorizontal: 9, height: 42, borderRadius: 14, backgroundColor: "rgba(10,14,30,0.86)", borderWidth: 1, borderColor: colors.magenta, alignItems: "center", justifyContent: "center" }, oppName: { color: colors.magenta, fontSize: 8, fontFamily: font.bold, maxWidth: 60 }, oppScore: { color: colors.text, fontSize: 14, fontFamily: font.heavy },
  quip: { position: "absolute", alignSelf: "center", maxWidth: "82%", backgroundColor: "rgba(7,10,24,0.9)", borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9 }, quipLabel: { color: colors.cyan, fontSize: 8, fontFamily: font.bold, letterSpacing: 1 }, quipText: { color: colors.text, fontSize: 12, fontFamily: font.bold, marginTop: 2 },
  intermission: { position: "absolute", top: "42%", alignSelf: "center", backgroundColor: "rgba(7,10,24,0.94)", borderWidth: 1, borderColor: colors.cyan, borderRadius: 18, paddingHorizontal: 22, paddingVertical: 14 }, intermissionText: { color: colors.cyan, fontSize: 16, fontFamily: font.heavy, letterSpacing: 1 },
  bottom: { position: "absolute", left: spacing.sm, right: spacing.sm, bottom: 0, gap: spacing.sm }, waitBox: { padding: spacing.md, alignItems: "center" }, waitText: { color: colors.muted, fontFamily: font.bold, fontSize: 12, letterSpacing: 1 },
  banner: { position: "absolute", top: "30%", left: 0, right: 0, alignItems: "center" }, bannerText: { color: colors.gold, fontFamily: font.heavy, fontSize: 48, letterSpacing: 2, textShadowColor: colors.magenta, textShadowRadius: 20, textShadowOffset: { width: 0, height: 0 } },
});
