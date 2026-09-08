import { storage } from "@/src/utils/storage";
import { api, supabase } from "@/src/api/client";

const ID_KEY = "ss_player_id";
const NAME_KEY = "ss_player_name";

export interface PlayerIdentity {
  id: string;
  name: string;
}

// The cache is only a convenience. The active Supabase user is authoritative so
// a logout/login on the same device can never inherit another account's player id.
export async function ensurePlayer(): Promise<PlayerIdentity> {
  const cachedId = await storage.getItem<string>(ID_KEY, "");
  const cachedName = await storage.getItem<string>(NAME_KEY, "");
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Sign in to HYPHSWORLD to use online Super Strike features.");
  }

  if (cachedId === user.id && cachedName) {
    return { id: cachedId, name: cachedName };
  }

  const fallbackName = cachedName || user.email?.split("@")[0] || "HYPHSWORLD Bowler";
  const player = await api.createPlayer(fallbackName);
  await storage.setItem(ID_KEY, player.id);
  await storage.setItem(NAME_KEY, player.name);
  return { id: player.id, name: player.name };
}

export async function getName(): Promise<string> {
  return (await storage.getItem<string>(NAME_KEY, "")) || "";
}

export async function setName(name: string): Promise<void> {
  await storage.setItem(NAME_KEY, name.trim());
}

export async function getPlayerId(): Promise<string> {
  return (await storage.getItem<string>(ID_KEY, "")) || "";
}
