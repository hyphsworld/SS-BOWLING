import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { isMuted, toggleMuted, subscribeMuted, playSound } from "@/src/audio/sounds";
import { colors, radius, shadow } from "@/src/theme/theme";

interface Props {
  color?: string;
  bg?: string;
  style?: ViewStyle;
}

export default function SoundToggle({ color, bg, style }: Props) {
  const [muted, setMuted] = useState(isMuted());

  useEffect(() => subscribeMuted(setMuted), []);

  return (
    <Pressable
      testID="sound-toggle-button"
      onPress={async () => {
        const nowMuted = await toggleMuted();
        if (!nowMuted) playSound("tap");
      }}
      style={[styles.btn, bg ? { backgroundColor: bg } : null, style]}
      hitSlop={8}
    >
      <Ionicons
        name={muted ? "volume-mute" : "volume-high"}
        size={18}
        color={color ?? colors.onSurface}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    ...shadow.card,
  },
});
