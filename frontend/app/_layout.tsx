import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useFonts } from "expo-font";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { initAudio } from "@/src/audio/sounds";

LogBox.ignoreAllLogs(true);

if (Platform.OS !== "web") {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

function AppShell() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  // Web must never be blocked by native splash/font/audio startup work.
  if (Platform.OS === "web") {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppShell />
      </GestureHandlerRootView>
    );
  }

  return <NativeRoot />;
}

function NativeRoot() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [fontsLoaded, fontsError] = useFonts({
    Fredoka: require("../assets/fonts/Fredoka.ttf"),
    Nunito: require("../assets/fonts/Nunito.ttf"),
  });

  const ready = (iconsLoaded || iconsError) && (fontsLoaded || fontsError);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  useEffect(() => {
    initAudio();
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <AppShell />
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
