import { storage } from "@/src/utils/storage";
import { api } from "@/src/api/client";

const ID_KEY = "ss_player_id";
const NAME_KEY = "ss_player_name";

export interface PlayerIdentity {
  id: string;
  name: string;
}

// Cache the signed-in HYPHSWORLD identity; authorization is always rechecked by Supabase.
export async function ensurePlayer(): Promise<PlayerIdentity> {
  const id = await storage.getItem<string>(ID_KEY, "");
  const name = await storage.getItem<string>(NAME_KEY, "");
  if (id && name) return { id, name };

  const fallbackName = name || "HYPHSWORLD Bowler";
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
