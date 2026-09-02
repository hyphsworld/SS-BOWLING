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

type WebHazardRegistry = Partial<Record<HazardId, boolean>>;

declare global {
  interface Window {
    __superStrikeHazards?: WebHazardRegistry;
  }
}

export const POP_WALL = {
  id: "pop-wall" as const,
  z: -3.7,
  // PopWall3D renders a 1.78-wide body plus rails centered at +/-0.84.
  // Use the real rendered body width for gameplay collision.
  width: 1.78,
  depth: 0.24,
  height: 0.78,
  warningMs: 650,
  holdMs: 900,
  retractMs: 320,
};

export const ALLEY_GATOR = {
  id: "alley-gator" as const,
  z: -3.7,
  width: 1.55,
};

// BowlingLane.web renders the normal ball with radius 0.16. Collision uses
// edge-to-edge contact against the visible hazard instead of an arbitrary
// proximity buffer.
export const BALL_CONTACT_RADIUS = 0.16;

export function setWebHazardActive(id: HazardId, active: boolean) {
  if (typeof window === "undefined") return;
  window.__superStrikeHazards = { ...(window.__superStrikeHazards || {}), [id]: active };
  window.dispatchEvent(new CustomEvent("super-strike-hazard-state", { detail: { id, active } }));
}

export function activeWebHazard(): HazardId | null {
  if (typeof window === "undefined") return null;
  if (window.__superStrikeHazards?.["pop-wall"]) return "pop-wall";
  if (window.__superStrikeHazards?.["alley-gator"]) return "alley-gator";
  return null;
}

export function popWallOutcome(powerup: PowerUpId | null, ballX: number, wallX: number) {
  const active = activeWebHazard();
  if (!active) return { blocked: false, smashed: false, bypassed: true };

  const width = active === "alley-gator" ? ALLEY_GATOR.width : POP_WALL.width;
  const hit = Math.abs(ballX - wallX) <= width * 0.5 + BALL_CONTACT_RADIUS;
  if (!hit) return { blocked: false, smashed: false, bypassed: true };
  if (powerup === "bomb") return { blocked: false, smashed: true, bypassed: true };
  if (powerup === "lightning") return { blocked: false, smashed: false, bypassed: true };
  return { blocked: true, smashed: false, bypassed: false };
}
