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

const SOURCES: Record<SoundName, any> = {
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
let unlocked = false;
const players: Partial<Record<SoundName, HTMLAudioElement>> = {};
const listeners = new Set<(m: boolean) => void>();

function resolveSource(source: any): string | null {
  if (!source) return null;
  if (typeof source === "string") return source;
  if (typeof source === "object" && typeof source.uri === "string") return source.uri;
  return null;
}

function ensurePlayers() {
  (Object.keys(SOURCES) as SoundName[]).forEach((name) => {
    if (players[name]) return;
    const src = resolveSource(SOURCES[name]);
    if (!src) return;
    const a = new Audio(src);
    a.preload = "auto";
    a.volume = VOLUMES[name] ?? 0.9;
    playsInline(a);
    players[name] = a;
  });
}

function playsInline(a: HTMLAudioElement) {
  try {
    a.setAttribute("playsinline", "true");
    a.setAttribute("webkit-playsinline", "true");
  } catch {}
}

async function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  ensurePlayers();
  const a = players.tap;
  if (!a) return;
  try {
    a.muted = true;
    await a.play();
    a.pause();
    a.currentTime = 0;
    a.muted = false;
  } catch {
    a.muted = false;
  }
}

export async function initAudio(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    muted = (await storage.getItem<boolean>(MUTE_KEY, false)) ?? false;
  } catch {}
  ensurePlayers();
  const onGesture = () => {
    unlockAudio();
    window.removeEventListener("pointerdown", onGesture);
    window.removeEventListener("touchstart", onGesture);
    window.removeEventListener("keydown", onGesture);
  };
  window.addEventListener("pointerdown", onGesture, { passive: true });
  window.addEventListener("touchstart", onGesture, { passive: true });
  window.addEventListener("keydown", onGesture);
}

export function playSound(name: SoundName): void {
  if (muted) return;
  ensurePlayers();
  const a = players[name];
  if (!a) return;
  try {
    a.pause();
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {}
}

export function stopSound(name: SoundName): void {
  const a = players[name];
  if (!a) return;
  try {
    a.pause();
    a.currentTime = 0;
  } catch {}
}

export function isMuted(): boolean {
  return muted;
}

export async function toggleMuted(): Promise<boolean> {
  if (!unlocked) await unlockAudio();
  muted = !muted;
  try {
    await storage.setItem(MUTE_KEY, muted);
  } catch {}
  if (muted) {
    Object.values(players).forEach((a) => {
      try { a?.pause(); } catch {}
    });
  }
  listeners.forEach((l) => l(muted));
  return muted;
}

export function subscribeMuted(cb: (m: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
