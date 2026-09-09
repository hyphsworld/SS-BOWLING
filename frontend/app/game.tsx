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
import { colors, font, radius, spacing } from "@/src/theme/theme";
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
import { api, Room } from "@/src/api/client";
import { ensurePlayer } from "@/src/store/player";
import { playSound, stopSound } from "@/src/audio/sounds";
import { getRival, Rival } from "@/src/store/rival";
import { getSelectedSkin } from "@/src/game/skins";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const FRAME_BREAK_MS = 2600;
const HUD_WHITE = "#FFFFFF";
const HUD_YELLOW = "#FFD60A";

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
  const [playerId, setPlayerId] = useState("");
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
    ensurePlayer().then((p) => {
      identity.current = p;
      setPlayerId(p.id);
    }).catch(() => {});
    getSelectedSkin().then(setBallSkin);
    if (mode === "cpu") {
      getRival().then((r) => { rivalRef.current = r; setRivalName(r.name); });
    }
  }, [mode]);

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

  const finishMultiplayer = useCallback((room: Room) => {
    if (routed.current) return;
    routed.current = true;
    const my = scoreGame(meRef.current.frames).total;
    const currentId = identity.current.id;
    const opponent = room.players.find((p) => p.id !== currentId);
    let result = "tie";
    if (room.winner === "tie") result = "tie";
    else if (room.winner === currentId) result = "win";
    else if (room.winner) result = "lose";

    router.replace({
      pathname: "/results",
      params: {
        mode: "multiplayer",
        myScore: String(my),
        oppScore: String(opponent?.score ?? 0),
        oppName: opponent?.name ?? "Opponent",
        result,
        strikes: String(countStrikes(meRef.current.frames)),
        spares: String(countSpares(meRef.current.frames)),
        rewardPoints: String(room.reward_amount ?? 0),
        balance: String(room.balance ?? 0),
      },
    });
  }, [router]);

  const handleRoom = useCallback((room: Room) => {
    const id = identity.current.id || playerId;
    const opp = room.players.find((p) => p.id !== id);
    if (opp) setOppRemote({ name: opp.name, score: opp.score, finished: opp.finished });
    if (room.status === "finished" && meRef.current.done) finishMultiplayer(room);
  }, [finishMultiplayer, playerId]);

  const postProgress = useCallback(async (finished: boolean) => {
    if (mode !== "multiplayer" || !code) return;
    const score = scoreGame(meRef.current.frames).total;
    try {
      if (!identity.current.id) {
        const p = await ensurePlayer();
        identity.current = p;
        setPlayerId(p.id);
      }
      const room = await api.updateProgress(code, {
        player_id: identity.current.id,
        name: identity.current.name,
        score,
        current_frame: meRef.current.currentFrame,
        finished,
      });
      handleRoom(room);
    } catch (_) {}
  }, [mode, code, handleRoom]);

  useEffect(() => {
    if (mode !== "multiplayer" || !code || !playerId) return;
    let stopped = false;
    let stopRealtime: (() => void) | null = null;

    const connect = async () => {
      try {
        const room = await api.getRoom(code);
        if (stopped) return;
        handleRoom(room);
        if (room.id) stopRealtime = api.watchRoom(code, room.id, handleRoom);
      } catch (_) {}
    };

    connect();
    const fallback = setInterval(async () => {
      try {
        handleRoom(await api.getRoom(code));
      } catch (_) {}
    }, 8000);

    return () => {
      stopped = true;
      clearInterval(fallback);
      if (stopRealtime) stopRealtime();
    };
  }, [mode, code, playerId, handleRoom]);

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
    if (mode === "multiplayer") {
      postProgress(meRef.current.done);
      if (meRef.current.done) { setPhase("over"); return; }
      resetNext();
      return;
    }
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
          <Pressable testID="quit-game-button" onPress={() => router.replace("/")} style={styles.iconBtn}><Ionicons name="close" size={24} color={HUD_WHITE} /></Pressable>
          <View style={styles.scorePill}><Text style={styles.scoreLabel}>SCORE</Text><Text style={styles.scoreValue}>{myTotal}</Text></View>
          {showOpp && <View style={styles.oppPill}><Text style={styles.oppName}>{mode === "cpu" ? rivalName : oppRemote?.name ?? "OPP"}</Text><Text style={styles.oppScore}>{oppTotal}</Text></View>}
          <View style={styles.framePill}><Text style={styles.frameLabel}>FRAME</Text><Text style={styles.frameValue}>{displayFrame}/10</Text></View>
          <SoundToggle />
        </View>
        <Scorecard frames={meRef.current.frames} currentFrame={meRef.current.currentFrame} active dark />
      </View>
      {quip && <View style={[styles.quip, { top: insets.top + 122 }]}><Text style={styles.quipLabel}>{quip.voice === "cpu" ? rivalName.toUpperCase() : "COMMENTATOR"}</Text><Text style={styles.quipText}>{quip.text}</Text></View>}
      {phase === "intermission" && intermissionText && <View style={styles.intermission}><Text style={styles.intermissionText}>{intermissionText}</Text></View>}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.sm }]}>
        <PowerUpTray energy={activeGame.energy} armed={armed} onArm={isMyTurn && phase === "aim" ? setArmed : () => {}} />
        {isMyTurn ? <TimingMeters phase={phase as "aim" | "power"} onLockAim={onLockAim} onLockPower={onLockPower} /> : <Glass style={styles.waitBox}><Text style={styles.waitText}>{phase === "cpu" ? `${rivalName} BOWLING…` : phase === "intermission" ? "RESETTING LANE…" : phase === "over" && mode === "multiplayer" ? "WAITING FOR FINAL SCORE…" : "BALL IN MOTION…"}</Text></Glass>}
      </View>
      {banner && <Animated.View entering={FadeIn.duration(100)} style={styles.banner}><Text style={styles.bannerText}>{banner}</Text></Animated.View>}
      <Celebration event={banner === "STRIKE!" ? "strike" : banner === "SPARE!" ? "spare" : null} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#05070D" },
  topHud: { position: "absolute", left: spacing.sm, right: spacing.sm, gap: spacing.xs },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  iconBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(10,14,30,0.9)", borderWidth: 1, borderColor: "rgba(255,255,255,0.26)", alignItems: "center", justifyContent: "center" },
  scorePill: { flexDirection: "row", alignItems: "baseline", gap: 6, paddingHorizontal: 12, height: 42, borderRadius: 14, backgroundColor: "rgba(10,14,30,0.92)", borderWidth: 1, borderColor: HUD_YELLOW, justifyContent: "center" },
  scoreLabel: { color: HUD_WHITE, fontSize: 9, fontFamily: font.display, letterSpacing: 1, fontWeight: "700" },
  scoreValue: { color: HUD_YELLOW, fontSize: 22, fontFamily: font.display, fontWeight: "700" },
  framePill: { paddingHorizontal: 10, height: 42, borderRadius: 14, backgroundColor: "rgba(10,14,30,0.92)", borderWidth: 1, borderColor: "rgba(255,255,255,0.32)", alignItems: "center", justifyContent: "center" },
  frameLabel: { color: HUD_WHITE, fontSize: 8, fontFamily: font.display, fontWeight: "700" },
  frameValue: { color: HUD_YELLOW, fontSize: 14, fontFamily: font.display, fontWeight: "700" },
  oppPill: { paddingHorizontal: 9, height: 42, borderRadius: 14, backgroundColor: "rgba(10,14,30,0.92)", borderWidth: 1, borderColor: HUD_YELLOW, alignItems: "center", justifyContent: "center" },
  oppName: { color: HUD_WHITE, fontSize: 8, fontFamily: font.display, fontWeight: "700", maxWidth: 60 },
  oppScore: { color: HUD_YELLOW, fontSize: 14, fontFamily: font.display, fontWeight: "700" },
  quip: { position: "absolute", alignSelf: "center", maxWidth: "82%", backgroundColor: "rgba(7,10,24,0.94)", borderWidth: 1, borderColor: "rgba(255,255,255,0.24)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9 },
  quipLabel: { color: HUD_YELLOW, fontSize: 8, fontFamily: font.display, fontWeight: "700", letterSpacing: 1 },
  quipText: { color: HUD_WHITE, fontSize: 12, fontFamily: font.display, fontWeight: "700", marginTop: 2 },
  intermission: { position: "absolute", top: "42%", alignSelf: "center", backgroundColor: "rgba(7,10,24,0.96)", borderWidth: 1, borderColor: HUD_YELLOW, borderRadius: 18, paddingHorizontal: 22, paddingVertical: 14 },
  intermissionText: { color: HUD_YELLOW, fontSize: 16, fontFamily: font.display, fontWeight: "700", letterSpacing: 1 },
  bottom: { position: "absolute", left: spacing.sm, right: spacing.sm, bottom: 0, gap: spacing.sm },
  waitBox: { padding: spacing.md, alignItems: "center" },
  waitText: { color: HUD_WHITE, fontFamily: font.display, fontWeight: "700", fontSize: 12, letterSpacing: 1 },
  banner: { position: "absolute", top: "30%", left: 0, right: 0, alignItems: "center" },
  bannerText: { color: HUD_YELLOW, fontFamily: font.display, fontWeight: "700", fontSize: 48, letterSpacing: 2, textShadowColor: "#FF2D55", textShadowRadius: 20, textShadowOffset: { width: 0, height: 0 } },
});
