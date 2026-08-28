import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, Platform, View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useFonts } from "expo-font";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { initAudio } from "@/src/audio/sounds";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

// Native needs the splash held until fonts register. On web, holding the
// splash while font loading stalls can leave Safari/in-app browsers blank.
if (Platform.OS !== "web") {
  SplashScreen.preventAutoHideAsync();
}

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [fontsLoaded, fontsError] = useFonts({
    Fredoka: require("../assets/fonts/Fredoka.ttf"),
    Nunito: require("../assets/fonts/Nunito.ttf"),
  });

  const ready = (iconsLoaded || iconsError) && (fontsLoaded || fontsError);

  useEffect(() => {
    if (Platform.OS !== "web" && ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  useEffect(() => {
    initAudio();
  }, []);

  // Never return a blank document while fonts are loading on web.
  // Render a visible lightweight fallback, then mount the router when ready.
  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          minHeight: "100%",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#08080d",
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
