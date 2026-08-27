import { storage } from "@/src/utils/storage";

export interface Rival {
  name: string;
  cpuWins: number;
  playerWins: number;
  ties: number;
  games: number;
  lastResult: "win" | "lose" | "tie" | null; // from the PLAYER's perspective
}

const KEY = "ss_rival";

const NAMES = [
  "Vince 'Gutterball' Romano",
  "Tanya Turbo",
  "Big Roll Rossi",
  "Neon Nikki",
  "Spare-Me Steve",
  "Kingpin Kaz",
  "Rico Ricochet",
  "Split-Happy Sasha",
];

const DEFAULT = (): Rival => ({
  name: NAMES[Math.floor(Math.random() * NAMES.length)],
  cpuWins: 0,
  playerWins: 0,
  ties: 0,
  games: 0,
  lastResult: null,
});

export async function getRival(): Promise<Rival> {
  const raw = await storage.getItem<string>(KEY, "");
  if (raw) {
    try {
      return JSON.parse(raw) as Rival;
    } catch {}
  }
  const r = DEFAULT();
  await storage.setItem(KEY, JSON.stringify(r));
  return r;
}

// result is from the PLAYER's perspective
export async function recordRivalResult(result: "win" | "lose" | "tie"): Promise<Rival> {
  const r = await getRival();
  r.games += 1;
  if (result === "win") r.playerWins += 1;
  else if (result === "lose") r.cpuWins += 1;
  else r.ties += 1;
  r.lastResult = result;
  await storage.setItem(KEY, JSON.stringify(r));
  return r;
}
