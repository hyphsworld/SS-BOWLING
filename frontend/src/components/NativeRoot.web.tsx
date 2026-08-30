import { Stack } from "expo-router";
import { useEffect } from "react";
import { initAudio } from "@/src/audio/sounds";
import LaneHazardOverlay from "@/src/components/LaneHazardOverlay.web";

export default function NativeRootWeb() {
  useEffect(() => {
    initAudio();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <LaneHazardOverlay />
    </>
  );
}
