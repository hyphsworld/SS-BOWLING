import { storage } from "@/src/utils/storage";

export interface Skin {
  id: string;
  name: string;
  desc: string;
  swatch: string; // UI swatch color
  color: number; // three hex
  emissive: number;
  emissiveIntensity: number;
  metalness: number;
  roughness: number;
  unlock: { games?: number; best?: number; strikes?: number };
  unlockText: string;
}

export const SKINS: Skin[] = [
  {
    id: "classic",
    name: "Classic Flame",
    desc: "The original marbled orange roller.",
    swatch: "#ff5a2a",
    color: 0xff5a2a,
    emissive: 0xff5a2a,
    emissiveIntensity: 0.28,
    metalness: 0.4,
    roughness: 0.12,
    unlock: {},
    unlockText: "",
  },
  {
    id: "chrome",
    name: "Chrome",
    desc: "Polished mirror-metal finish.",
    swatch: "#cfd6de",
    color: 0xdfe6ee,
    emissive: 0x8899aa,
    emissiveIntensity: 0.12,
    metalness: 1.0,
    roughness: 0.04,
    unlock: { games: 3 },
    unlockText: "Play 3 games",
  },
  {
    id: "galaxy",
    name: "Galaxy",
    desc: "A swirling cosmic purple orb.",
    swatch: "#7a4bff",
    color: 0x5a3aff,
    emissive: 0x7a4bff,
    emissiveIntensity: 0.55,
    metalness: 0.6,
    roughness: 0.2,
    unlock: { best: 120 },
    unlockText: "Score 120+ in a game",
  },
  {
    id: "neon",
    name: "Neon Core",
    desc: "Glowing electric-blue energy.",
    swatch: "#22e1ff",
    color: 0x22e1ff,
    emissive: 0x22e1ff,
    emissiveIntensity: 1.0,
    metalness: 0.3,
    roughness: 0.15,
    unlock: { strikes: 5 },
    unlockText: "Land 5 total strikes",
  },
];

export const SKIN_MAP: Record<string, Skin> = SKINS.reduce(
  (a, s) => ({ ...a, [s.id]: s }),
  {} as Record<string, Skin>,
);

export interface UnlockStats {
  games: number;
  best: number;
  total_strikes: number;
}

export function isSkinUnlocked(skin: Skin, stats: UnlockStats): boolean {
  const u = skin.unlock;
  if (u.games && stats.games < u.games) return false;
  if (u.best && stats.best < u.best) return false;
  if (u.strikes && stats.total_strikes < u.strikes) return false;
  return true;
}

const KEY = "ss_ball_skin";

export async function getSelectedSkin(): Promise<string> {
  return (await storage.getItem<string>(KEY, "classic")) || "classic";
}

export async function setSelectedSkin(id: string): Promise<void> {
  await storage.setItem(KEY, id);
}
