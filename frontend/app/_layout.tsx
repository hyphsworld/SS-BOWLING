import { Stack } from "expo-router";
import { Platform } from "react-native";

import NativeRoot from "@/src/components/NativeRoot";

export default function RootLayout() {
  if (Platform.OS === "web") {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  return <NativeRoot />;
}
