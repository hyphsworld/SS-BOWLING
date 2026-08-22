import { colors } from "@/src/theme/theme";

export type PowerUpId = "magnet" | "giant" | "muscle" | "bomb" | "lightning";

export interface PowerUp {
  id: PowerUpId;
  name: string;
  short: string;
  icon: string; // Ionicons name
  color: string;
  cost: number;
  desc: string;
}

export const POWERUPS: PowerUp[] = [
  {
    id: "magnet",
    name: "Magnet Ball",
    short: "Magnet",
    icon: "magnet",
    color: colors.brandSecondary,
    cost: 40,
    desc: "Curves straight into the pocket for a guided hit.",
  },
  {
    id: "giant",
    name: "Giant Ball",
    short: "Giant",
    icon: "ellipse",
    color: colors.brand,
    cost: 45,
    desc: "A huge ball that sweeps a wide row of pins.",
  },
  {
    id: "muscle",
    name: "Muscle Arm",
    short: "Muscle",
    icon: "barbell",
    color: colors.brandPrimary,
    cost: 55,
    desc: "Super-strength throw that smashes deep.",
  },
  {
    id: "bomb",
    name: "Bomb Ball",
    short: "Bomb",
    icon: "flame",
    color: "#1A1A1A",
    cost: 75,
    desc: "Explodes on impact, blasting nearby pins.",
  },
  {
    id: "lightning",
    name: "Laser Wipe",
    short: "Laser",
    icon: "flash",
    color: colors.brandTertiary,
    cost: 100,
    desc: "Vaporizes every standing pin. Guaranteed strike.",
  },
];

export const POWERUP_MAP: Record<PowerUpId, PowerUp> = POWERUPS.reduce(
  (acc, p) => ({ ...acc, [p.id]: p }),
  {} as Record<PowerUpId, PowerUp>,
);
