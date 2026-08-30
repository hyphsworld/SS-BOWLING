import { Asset } from "expo-asset";
import { storage } from "@/src/utils/storage";

export type SoundName =
  | "tap"
  | "lock"
  | "ball_roll"
  | "pin_crash"
  | "strike"
  | "spare"
  | "gutter"
  | "powerup"
  | "win";

const SOURCES: Record<SoundName, number> = {
  tap: require("../../assets/sounds/tap.wav"),
  lock: require("../../assets/sounds/lock.wav"),
  ball_roll: require("../../assets/sounds/ball_roll.wav"),
  pin_crash: require("../../assets/sounds/pin_crash.wav"),
  strike: require("../../assets/sounds/strike.wav"),
  spare: require("../../assets/sounds/spare.wav"),
  gutter: require("../../assets/sounds/gutter.wav"),
  powerup: require("../../assets/sounds/powerup.wav"),
  win: require("../../assets/sounds/win.wav"),
};

const VOLUMES: Partial<Record<SoundName, number>> = {
  ball_roll: 0.5,
  tap: 0.5,
  lock: 0.7,
};

const MUTE_KEY = "ss_sound_muted";
let muted = false;
let initialized = false;
const players: Partial<Record<SoundName, HTMLAudioElement>> = {};
const listeners = new Set<(m: boolean) => void>();

function ensurePlayers(): void {
  (Object.keys(SOURCES) as SoundName[]).forEach((name) => {
    if (players[name]) return;
    try {
      const uri = Asset.fromModule(SOURCES[name]).uri;
      if (!uri) return;
      const audio = new Audio(uri);
      audio.preload = "auto";
      audio.volume = VOLUMES[name] ?? 0.9;
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      players[name] = audio;
    } catch {}
  });
}

function start(name: SoundName, silent = false): void {
  ensurePlayers();
  const audio = players[name];
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
    audio.muted = silent;
    const result = audio.play();
    if (result && typeof result.then === "function") {
      result
        .then(() => {
          if (silent) {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
          }
        })
        .catch(() => {
          audio.muted = false;
        });
    }
  } catch {
    audio.muted = false;
  }
}

export async function initAudio(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    muted = (await storage.getItem<boolean>(MUTE_KEY, false)) ?? false;
  } catch {}
  ensurePlayers();
}

export function playSound(name: SoundName): void {
  if (muted) return;
  start(name);
}

export function stopSound(name: SoundName): void {
  const audio = players[name];
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {}
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMuted(): Promise<boolean> {
  ensurePlayers();
  muted = !muted;

  // On iOS Safari, audio playback must begin inside the direct tap event.
  // Start the tap sound synchronously before any async storage work.
  if (!muted) {
    start("tap");
  } else {
    Object.values(players).forEach((audio) => {
      try {
        audio?.pause();
      } catch {}
    });
  }

  listeners.forEach((listener) => listener(muted));
  void storage.setItem(MUTE_KEY, muted).catch(() => {});
  return Promise.resolve(muted);
}

export function subscribeMuted(cb: (m: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
