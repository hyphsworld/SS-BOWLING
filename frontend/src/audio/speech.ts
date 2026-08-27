import * as Speech from "expo-speech";
import { isMuted } from "@/src/audio/sounds";

// Coach Luna's voice — respects the global sound mute toggle.
export function speak(text: string) {
  if (isMuted() || !text) return;
  try {
    Speech.stop();
    Speech.speak(text, { rate: 0.98, pitch: 1.12 });
  } catch {}
}

export function stopSpeaking() {
  try {
    Speech.stop();
  } catch {}
}
