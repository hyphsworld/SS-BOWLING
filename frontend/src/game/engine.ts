import { PowerUpId, POWERUP_MAP } from "@/src/game/powerups";

// Standard 10-pin layout in lane-x units. row 0 = front (nearest bowler).
export const PINS: Record<number, { x: number; row: number }> = {
  1: { x: 0, row: 0 },
  2: { x: -0.5, row: 1 },
  3: { x: 0.5, row: 1 },
  4: { x: -1, row: 2 },
  5: { x: 0, row: 2 },
  6: { x: 1, row: 2 },
  7: { x: -1.5, row: 3 },
  8: { x: -0.5, row: 3 },
  9: { x: 0.5, row: 3 },
  10: { x: 1.5, row: 3 },
};

export const ALL_PINS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const POCKET_X = 0.28; // ideal ball entry (1-3 pocket)
export const AIM_SCALE = 1.6; // aim (-1..1) -> lane-x

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ballX is already in lane-x units. Returns knocked pin ids.
export function computeThrow(
  standing: number[],
  ballX: number,
  power: number,
  powerup: PowerUpId | null,
): number[] {
  if (powerup === "lightning") return [...standing];
  if (powerup === "bomb") {
    return standing.filter((id) => Math.abs(PINS[id].x - ballX) < 2.4);
  }
  let x = ballX;
  let R = 0.5 + power * 0.6;
  if (powerup === "magnet") {
    x = POCKET_X;
    R += 0.45;
  }
  if (powerup === "giant") R += 1.0;
  if (powerup === "muscle") {
    power = Math.max(power, 0.9);
    R += 0.6;
  }

  const knocked = new Set<number>();
  // direct contact
  for (const id of standing) {
    const d = Math.abs(PINS[id].x - x);
    const depthFactor = clamp(0.55 + power * 0.55 - PINS[id].row * 0.06, 0.1, 1);
    const chance = clamp(1 - d / R, 0, 1) * depthFactor;
    if (Math.random() < chance) knocked.add(id);
  }
  // scatter / chain reaction
  for (let pass = 0; pass < 3; pass++) {
    for (const id of standing) {
      if (knocked.has(id)) continue;
      let scatter = 0;
      for (const kid of knocked) {
        const dx = Math.abs(PINS[id].x - PINS[kid].x);
        const dr = PINS[id].row - PINS[kid].row; // positive => id is behind kid
        if (dx < 0.85 && dr >= 0 && dr <= 1) {
          scatter = Math.max(scatter, 0.6 - dx * 0.3);
        }
      }
      scatter *= 0.6 + power * 0.5;
      if (scatter > 0 && Math.random() < scatter) knocked.add(id);
    }
  }
  return [...knocked];
}

export interface Frame {
  rolls: number[];
}

export interface PlayerGame {
  frames: Frame[];
  currentFrame: number;
  standing: number[];
  energy: number;
  done: boolean;
}

export function newGame(): PlayerGame {
  return {
    frames: Array.from({ length: 10 }, () => ({ rolls: [] })),
    currentFrame: 0,
    standing: [...ALL_PINS],
    energy: 0,
    done: false,
  };
}

export interface ThrowResult {
  knockedCount: number;
  knocked: number[];
  isStrike: boolean;
  isSpare: boolean;
  cleared: boolean;
  frameEnded: boolean;
  gameEnded: boolean;
}

// Mutates game in place. aim is -1..1.
export function applyThrow(
  g: PlayerGame,
  aim: number,
  power: number,
  powerup: PowerUpId | null,
): ThrowResult {
  if (powerup) {
    g.energy = Math.max(0, g.energy - POWERUP_MAP[powerup].cost);
  }
  const knocked = computeThrow(g.standing, aim * AIM_SCALE, power, powerup);
  const kset = new Set(knocked);
  const f = g.frames[g.currentFrame];
  const knockedCount = knocked.length;
  f.rolls.push(knockedCount);
  g.standing = g.standing.filter((id) => !kset.has(id));

  const cleared = g.standing.length === 0;
  const isStrike = f.rolls.length === 1 && knockedCount === 10;
  const isSpare = !isStrike && cleared && f.rolls.length >= 2;

  let gain = knockedCount * 3;
  if (isStrike) gain += 25;
  else if (cleared) gain += 15;
  g.energy = Math.min(100, g.energy + gain);

  let frameEnded = false;
  if (g.currentFrame < 9) {
    if (isStrike || f.rolls.length === 2) {
      g.currentFrame++;
      g.standing = [...ALL_PINS];
      frameEnded = true;
    }
  } else {
    const r = f.rolls;
    const eligible = r[0] === 10 || (r.length >= 2 && r[0] + r[1] === 10);
    const allowed = eligible ? 3 : 2;
    if (r.length >= allowed) {
      g.done = true;
      frameEnded = true;
    } else if (g.standing.length === 0) {
      g.standing = [...ALL_PINS];
    }
  }

  return {
    knockedCount,
    knocked,
    isStrike,
    isSpare,
    cleared,
    frameEnded,
    gameEnded: g.done,
  };
}

export interface ScoreResult {
  frameScores: (number | null)[];
  total: number;
}

export function scoreGame(frames: Frame[]): ScoreResult {
  const rolls: number[] = [];
  const frameStart: number[] = [];
  frames.forEach((f) => {
    frameStart.push(rolls.length);
    f.rolls.forEach((r) => rolls.push(r));
  });

  const frameScores: (number | null)[] = [];
  let total = 0;
  let resolved = true;

  for (let frame = 0; frame < Math.min(frames.length, 10); frame++) {
    const i = frameStart[frame];
    if (rolls[i] === undefined) {
      frameScores.push(null);
      continue;
    }
    if (rolls[i] === 10) {
      const b1 = rolls[i + 1];
      const b2 = rolls[i + 2];
      if (b1 === undefined || b2 === undefined) {
        frameScores.push(null);
        resolved = false;
      } else {
        total += 10 + b1 + b2;
        frameScores.push(resolved ? total : null);
      }
    } else if (rolls[i + 1] !== undefined && rolls[i] + rolls[i + 1] === 10) {
      const b = rolls[i + 2];
      if (b === undefined) {
        frameScores.push(null);
        resolved = false;
      } else {
        total += 10 + b;
        frameScores.push(resolved ? total : null);
      }
    } else {
      if (rolls[i + 1] === undefined) {
        frameScores.push(null);
        resolved = false;
      } else {
        total += rolls[i] + rolls[i + 1];
        frameScores.push(resolved ? total : null);
      }
    }
  }
  return { frameScores, total };
}

export function countStrikes(frames: Frame[]): number {
  return frames.filter((f) => f.rolls[0] === 10).length;
}

export function countSpares(frames: Frame[]): number {
  return frames.filter(
    (f) => f.rolls[0] !== 10 && f.rolls.length >= 2 && f.rolls[0] + f.rolls[1] === 10,
  ).length;
}

// Roll symbol for scorecard cell (per roll within a frame).
export function rollSymbol(
  frameIndex: number,
  rollIndex: number,
  rolls: number[],
): string {
  const v = rolls[rollIndex];
  if (v === undefined) return "";
  if (frameIndex < 9) {
    if (rollIndex === 0 && v === 10) return "X";
    if (rollIndex === 1 && rolls[0] + v === 10) return "/";
    if (v === 0) return "-";
    return String(v);
  }
  // 10th frame
  if (v === 10) return "X";
  if (v === 0) return "-";
  if (rollIndex > 0 && rolls[rollIndex - 1] !== 10 && rolls[rollIndex - 1] + v === 10)
    return "/";
  return String(v);
}
