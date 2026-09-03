import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Super Strike Supabase configuration is missing.");

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

async function requireUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Sign in to HYPHSWORLD to use online Super Strike features.");
  return user;
}
async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  await requireUser();
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export interface RoomPlayer { id: string; name: string; score: number; current_frame: number; finished: boolean; is_host: boolean; }
export interface Room { code: string; status: "waiting" | "playing" | "finished"; winner: string | null; players: RoomPlayer[]; }

const localQuip = (event: string) => ({ text:
  event === "strike" ? "That was pure pressure — STRIKE!" :
  event === "spare" ? "Clean pickup. That's a spare!" :
  event === "gutter" ? "Shake it off and line up the next one." :
  "Stay locked in and hit your mark."
});

export const api = {
  createPlayer: async (name: string) => {
    const user = await requireUser();
    const cleanName = name.trim().slice(0, 40) || user.email?.split("@")[0] || "Bowler";
    const { data, error } = await supabase.from("profiles")
      .upsert({ id: user.id, display_name: cleanName, updated_at: new Date().toISOString() }, { onConflict: "id" })
      .select("id, display_name").single();
    if (error) throw new Error(error.message);
    return { id: data.id, name: data.display_name || cleanName };
  },
  getStats: async (_playerId: string) => {
    const user = await requireUser();
    const { data, error } = await supabase.from("game_scores").select("score, metadata")
      .eq("user_id", user.id).eq("game_key", "super_strike");
    if (error) throw new Error(error.message);
    const rows = data || [];
    const total = rows.reduce((sum, row) => sum + row.score, 0);
    return {
      games: rows.length,
      best: rows.reduce((best, row) => Math.max(best, row.score), 0),
      average: rows.length ? Math.round(total / rows.length) : 0,
      total_strikes: rows.reduce((sum, row) => sum + Number((row.metadata as any)?.strikes || 0), 0),
      wins: rows.filter((row) => (row.metadata as any)?.result === "win").length,
    };
  },
  submitScore: async (payload: { player_id: string; name: string; score: number; mode: string; strikes: number; spares: number; result?: string | null }) =>
    rpc("submit_game_run", { p_game_key: "super_strike", p_score: payload.score, p_points_delta: 0,
      p_metadata: { mode: payload.mode, strikes: payload.strikes, spares: payload.spares, result: payload.result || null } }),
  leaderboard: async (limit = 20): Promise<Array<{ id: string; name: string; score: number; mode: string; strikes: number }>> => {
    const { data, error } = await supabase.from("game_scores")
      .select("user_id, score, metadata, profiles!game_scores_user_id_fkey(display_name)")
      .eq("game_key", "super_strike").order("score", { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map((row: any) => ({ id: row.user_id,
      name: row.profiles?.display_name || "HYPHSWORLD Bowler", score: row.score,
      mode: String(row.metadata?.mode || "solo"), strikes: Number(row.metadata?.strikes || 0) }));
  },
  createRoom: async (_playerId: string, _name: string): Promise<Room> => rpc("create_super_strike_room"),
  joinRoom: async (code: string, _playerId: string, _name: string): Promise<Room> => rpc("join_super_strike_room", { p_room_code: code }),
  getRoom: async (code: string): Promise<Room> => rpc("get_super_strike_room", { p_room_code: code }),
  updateProgress: async (code: string, payload: { player_id?: string; name?: string; score: number; current_frame: number; finished: boolean }): Promise<Room> =>
    rpc("update_super_strike_room", { p_room_code: code, p_score: payload.score,
      p_current_frame: payload.current_frame, p_finished: payload.finished }),
  aiQuip: async (payload: { voice?: string; event: string; knocked?: number; frame?: number; opp_name?: string; rival_name?: string; cpu_wins?: number; player_wins?: number; last_result?: string }) => localQuip(payload.event),
  aiCoach: async (payload: { score: number; strikes: number; spares?: number; mode?: string; result?: string | null }) => ({
    text: payload.strikes > 2 ? "Your pocket control was working. Keep that same line." :
      "Focus on timing the aim meter near the pocket marker."
  }),
  aiChat: async (_payload: { session_id: string; message: string; name?: string }) => ({ text: "Coach chat is temporarily unavailable." }),
  aiChatHistory: async (_sessionId: string): Promise<Array<{ role: "user" | "assistant"; content: string }>> => [],
};
