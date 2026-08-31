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
  const [knockdown, setKnockdown] = useState<{ key: number; pins: number[] } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [oppRemote, setOppRemote] = useState<{
    name: string;
    score: number;
    finished: boolean;
  } | null>(null);
  const [quip, setQuip] = useState<{ text: string; voice: "commentator" | "cpu" } | null>(null);
  const quipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    ensurePlayer()
      .then((p) => {
        identity.current = p;
      })
      .catch(() => {});
    getSelectedSkin().then(setBallSkin);
    if (mode === "cpu") {
      getRival().then((r) => {
        rivalRef.current = r;
        setRivalName(r.name);
      });
    }
  }, []);

  const activeGame = active === "me" ? meRef.current : oppRef.current;

  // ---------- AI quips ----------
  const showQuip = useCallback(
    (voice: "commentator" | "cpu", event: "strike" | "spare" | "gutter" | "open", knocked: number) => {
      const r = rivalRef.current;
      api
        .aiQuip({
          voice,
          event,
          knocked,
          frame: meRef.current.currentFrame + 1,
          opp_name: identity.current.name,
          rival_name: voice === "cpu" ? r?.name : undefined,
          cpu_wins: voice === "cpu" ? r?.cpuWins ?? 0 : undefined,
          player_wins: voice === "cpu" ? r?.playerWins ?? 0 : undefined,
          last_result: voice === "cpu" ? r?.lastResult ?? undefined : undefined,
        })
        .then((res) => {
          if (!res?.text) return;
          setQuip({ text: res.text, voice });
          if (quipTimer.current) clearTimeout(quipTimer.current);
          quipTimer.current = setTimeout(() => setQuip(null), 4200);
        })
        .catch(() => {});
    },
    [],
  );

  useEffect(() => () => quipTimer.current && clearTimeout(quipTimer.current), []);

  // ---------- Banner ----------
  const showBanner = (res: ThrowResult) => {
    let text: string | null = null;
    if (res.isStrike) text = "STRIKE!";
    else if (res.isSpare) text = "SPARE!";
    else if (res.knockedCount === 0) text = "GUTTER";
    if (text) {
      setBanner(text);
      if (res.isStrike) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
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
    setKnockdown({ key: throwKey.current, pins: res.knocked });
    stopSound("ball_roll");

    // Keep all result audio locked to the exact ball-arrival/impact moment.
    if (res.knockedCount > 0) playSound("pin_crash");
    if (res.isStrike) playSound("strike");
    else if (res.isSpare) playSound("spare");
    else if (res.knockedCount === 0) playSound("gutter");

    showBanner(res);
    force();
    if (p.owner === "me") {
      const event = res.isStrike
        ? "strike"
        : res.isSpare
          ? "spare"
          : res.knockedCount === 0
            ? "gutter"
            : "open";
      lastEvent.current = event;
      if (event !== "open") showQuip("commentator", event, res.knockedCount);
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
    if (pu) playSound("powerup");
    playSound("ball_roll");
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
