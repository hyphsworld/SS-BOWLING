import React from "react";
import { View, StyleSheet, ViewStyle, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { radius, colors } from "@/src/theme/theme";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  tint?: "light" | "dark";
  testID?: string;
}

// Glassmorphic surface (blur on native, translucent fallback on web/low-end).
export default function Glass({
  children,
  style,
  intensity = 40,
  tint = "light",
  testID,
}: Props) {
  if (Platform.OS === "web") {
    return (
      <View
        testID={testID}
        style={[
          styles.base,
          {
            backgroundColor:
              tint === "dark" ? "rgba(28,28,30,0.72)" : "rgba(255,255,255,0.72)",
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }
  return (
    <BlurView testID={testID} intensity={intensity} tint={tint} style={[styles.base, style]}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
});
