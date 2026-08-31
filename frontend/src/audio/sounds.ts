import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
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

// Static requires (Metro needs literal paths).
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
  strike: 1.0,
  gutter: 1.0,
};

const MUTE_KEY = "ss_sound_muted";

let players: Partial<Record<SoundName, AudioPlayer>> = {};
let initialized = false;
let muted = false;
const listeners = new Set<(m: boolean) => void>();

export async function initAudio(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    muted = (await storage.getItem<boolean>(MUTE_KEY, false)) ?? false;
  } catch {}
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
    });
  } catch {}
  (Object.keys(SOURCES) as SoundName[]).forEach((name) => {
    try {
      const p = createAudioPlayer(SOURCES[name]);
      p.volume = VOLUMES[name] ?? 0.9;
      players[name] = p;
    } catch {}
  });
}

export function playSound(name: SoundName): void {
  if (muted) return;
  const p = players[name];
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch {}
}

export function stopSound(name: SoundName): void {
  const p = players[name];
  if (!p) return;
  try {
    p.pause();
    p.seekTo(0);
  } catch {}
}

export function isMuted(): boolean {
  return muted;
}

export async function toggleMuted(): Promise<boolean> {
  muted = !muted;
  try {
    await storage.setItem(MUTE_KEY, muted);
  } catch {}
  if (muted) {
    Object.values(players).forEach((p) => {
      try {
        p?.pause();
      } catch {}
    });
  }
  listeners.forEach((l) => l(muted));
  return muted;
}

export function subscribeMuted(cb: (m: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
