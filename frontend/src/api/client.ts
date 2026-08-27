const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const API = `${BASE}/api`;

async function req(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export interface RoomPlayer {
  id: string;
  name: string;
  score: number;
  current_frame: number;
  finished: boolean;
  is_host: boolean;
}

export interface Room {
  code: string;
  status: "waiting" | "playing" | "finished";
  winner: string | null;
  players: RoomPlayer[];
}

export const api = {
  createPlayer: (name: string) =>
    req("/players", { method: "POST", body: JSON.stringify({ name }) }),

  getStats: (playerId: string) => req(`/players/${playerId}/stats`),

  submitScore: (payload: {
    player_id: string;
    name: string;
    score: number;
    mode: string;
    strikes: number;
    spares: number;
    result?: string | null;
  }) => req("/scores", { method: "POST", body: JSON.stringify(payload) }),

  leaderboard: (limit = 20) => req(`/leaderboard?limit=${limit}`),

  createRoom: (player_id: string, name: string): Promise<Room> =>
    req("/rooms", { method: "POST", body: JSON.stringify({ player_id, name }) }),

  joinRoom: (code: string, player_id: string, name: string): Promise<Room> =>
    req(`/rooms/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ player_id, name }),
    }),

  getRoom: (code: string): Promise<Room> => req(`/rooms/${code}`),

  updateProgress: (
    code: string,
    payload: {
      player_id: string;
      name: string;
      score: number;
      current_frame: number;
      finished: boolean;
    },
  ): Promise<Room> =>
    req(`/rooms/${code}/progress`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  aiQuip: (payload: {
    voice: "commentator" | "cpu";
    event: "strike" | "spare" | "gutter" | "open";
    knocked?: number;
    frame?: number;
    opp_name?: string | null;
  }): Promise<{ text: string }> =>
    req("/ai/quip", { method: "POST", body: JSON.stringify(payload) }),

  aiCoach: (payload: {
    score: number;
    strikes: number;
    spares: number;
    gutters?: number;
    mode: string;
    result?: string | null;
  }): Promise<{ text: string }> =>
    req("/ai/coach", { method: "POST", body: JSON.stringify(payload) }),

  aiChat: (payload: { session_id: string; message: string; name?: string }): Promise<{ text: string }> =>
    req("/ai/chat", { method: "POST", body: JSON.stringify(payload) }),

  aiChatHistory: (session_id: string): Promise<{ role: string; content: string; created_at: string }[]> =>
    req(`/ai/chat/${session_id}`),
};
