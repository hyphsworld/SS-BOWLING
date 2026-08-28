import { PowerUpId } from "@/src/game/powerups";

export type LaneHazardKind = "gator" | "wall";

export interface LaneHazard {
  key: number;
  kind: LaneHazardKind;
  laneX: number; // -1..1 target lane position
  warningMs: number;
}

export interface HazardResolution {
  caught: boolean;
  bypassed: boolean;
  smashed: boolean;
  banner: string | null;
}

const GATOR_WINDOW = 0.38;
const WALL_WINDOW = 0.34;

export function rollLaneHazard(key: number, ownerIsPlayer: boolean): LaneHazard | null {
  // Keep hazards occasional and readable. CPU throws can still trigger one,
  // but player throws get the slightly higher arcade chance.
  const chance = ownerIsPlayer ? 0.28 : 0.18;
  if (Math.random() > chance) return null;
  return {
    key,
    kind: Math.random() < 0.58 ? "gator" : "wall",
    laneX: Math.random() * 1.6 - 0.8,
    warningMs: 950 + Math.round(Math.random() * 250),
  };
}

export function resolveLaneHazard(
  hazard: LaneHazard | null,
  aim: number,
  powerup: PowerUpId | null,
): HazardResolution {
  if (!hazard) return { caught: false, bypassed: false, smashed: false, banner: null };

  if (powerup === "lightning") {
    return { caught: false, bypassed: true, smashed: false, banner: "LIGHTNING BYPASS!" };
  }

  if (hazard.kind === "wall" && (powerup === "giant" || powerup === "muscle")) {
    return { caught: false, bypassed: false, smashed: true, banner: "WALL SMASHED!" };
  }

  // Magnet bends the path away from trouble. Treat it as extra steering room.
  const magnetBonus = powerup === "magnet" ? 0.25 : 0;
  const window = hazard.kind === "gator" ? GATOR_WINDOW : WALL_WINDOW;
  const distance = Math.abs(aim - hazard.laneX);
  const caught = distance < Math.max(0.12, window - magnetBonus);

  return {
    caught,
    bypassed: false,
    smashed: false,
    banner: caught
      ? hazard.kind === "gator"
        ? "GATOR GOT IT!"
        : "BLOCKED!"
      : hazard.kind === "gator"
        ? "GATOR DODGED!"
        : "WALL DODGED!",
  };
}
