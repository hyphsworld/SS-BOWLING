import { useEffect } from "react";
import { Stack } from "expo-router";
import { initAudio } from "@/src/audio/sounds";

export default function RootLayout() {
  useEffect(() => {
    initAudio().catch(() => {});
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
