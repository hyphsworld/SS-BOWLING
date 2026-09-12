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
  unlock: { games?: number; best?: number; strikes?: number; points?: number };
  unlockText: string;
  effect?: "fire" | "ice";
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
  {
    id: "ice",
    name: "Ice Breaker",
    desc: "Frozen-blue core with a sparkling ice trail.",
    swatch: "#8ff6ff",
    color: 0xc8fbff,
    emissive: 0x52dfff,
    emissiveIntensity: 1.35,
    metalness: 0.35,
    roughness: 0.08,
    unlock: { strikes: 10 },
    unlockText: "Land 10 total strikes",
    effect: "ice",
  },
  {
    id: "fire",
    name: "Inferno 180",
    desc: "Molten-red core wrapped in a full flame trail.",
    swatch: "#ff3b12",
    color: 0xff431f,
    emissive: 0xff2600,
    emissiveIntensity: 1.65,
    metalness: 0.18,
    roughness: 0.22,
    unlock: { best: 180 },
    unlockText: "Score 180+ in a game",
    effect: "fire",
  },
  {
    id: "golden_gate",
    name: "Golden Gate",
    desc: "Championship gold with International Orange glow.",
    swatch: "#f5c542",
    color: 0xffb81c,
    emissive: 0xff4f1f,
    emissiveIntensity: 0.72,
    metalness: 0.95,
    roughness: 0.08,
    unlock: { games: 15 },
    unlockText: "Complete 15 games",
  },
  {
    id: "hyphy_purple",
    name: "Hyphy Purple",
    desc: "Deep Bay purple charged with neon energy.",
    swatch: "#b83dff",
    color: 0x7814d4,
    emissive: 0xd12cff,
    emissiveIntensity: 1.25,
    metalness: 0.48,
    roughness: 0.12,
    unlock: { strikes: 25 },
    unlockText: "Land 25 total strikes",
  },
  {
    id: "graffiti_bomb",
    name: "Graffiti Bomb",
    desc: "Blacktop core hit with electric graffiti colors.",
    swatch: "#23f0ff",
    color: 0x12131a,
    emissive: 0xff2bd6,
    emissiveIntensity: 1.4,
    metalness: 0.62,
    roughness: 0.16,
    unlock: { points: 1500 },
    unlockText: "1,500 Cool Points",
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

export function isSkinUnlocked(skin: Skin, stats: UnlockStats, ownedSkins: string[] = []): boolean {
  const u = skin.unlock;
  if (u.points) return ownedSkins.includes(skin.id);
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
