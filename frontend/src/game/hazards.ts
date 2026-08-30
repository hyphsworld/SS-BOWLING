import { PowerUpId } from "@/src/game/powerups";

export type HazardId = "pop-wall" | "alley-gator";

export interface HazardState {
  id: HazardId;
  active: boolean;
  warning: boolean;
  laneX: number;
  startedAt: number;
  durationMs: number;
}

export const POP_WALL = {
  id: "pop-wall" as const,
  z: -3.7,
  width: 1.05,
  height: 0.72,
  warningMs: 650,
  holdMs: 900,
  retractMs: 320,
};

export function popWallOutcome(powerup: PowerUpId | null, ballX: number, wallX: number) {
  const hit = Math.abs(ballX - wallX) < POP_WALL.width * 0.52;
  if (!hit) return { blocked: false, smashed: false, bypassed: true };
  if (powerup === "giant" || powerup === "muscle" || powerup === "bomb") {
    return { blocked: false, smashed: true, bypassed: true };
  }
  if (powerup === "lightning") {
    return { blocked: false, smashed: false, bypassed: true };
  }
  if (powerup === "magnet") {
    return { blocked: false, smashed: false, bypassed: true };
  }
  return { blocked: true, smashed: false, bypassed: false };
}
