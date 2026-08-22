import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  ActivityIndicator,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing, font, type, shadow } from "@/src/theme/theme";

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "tertiary" | "dark" | "outline";
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
  size?: "lg" | "md";
}

const BG: Record<string, string> = {
  primary: colors.brandPrimary,
  secondary: colors.brandSecondary,
  tertiary: colors.brand,
  dark: colors.surfaceInverse,
  outline: "transparent",
};
const FG: Record<string, string> = {
  primary: colors.onBrandPrimary,
  secondary: colors.onBrandSecondary,
  tertiary: colors.onBrandTertiary,
  dark: colors.onSurfaceInverse,
  outline: colors.onSurface,
};

export default function PrimaryButton({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  loading,
  style,
  testID,
  size = "lg",
}: Props) {
  const handle = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };
  return (
    <Pressable
      testID={testID}
      onPress={handle}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        size === "md" && styles.btnMd,
        { backgroundColor: BG[variant] },
        variant === "outline" && styles.outline,
        shadow.card,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={FG[variant]} />
      ) : (
        <View style={styles.row}>
          {icon ? (
            <Ionicons
              name={icon as any}
              size={size === "md" ? 18 : 22}
              color={FG[variant]}
              style={{ marginRight: spacing.sm }}
            />
          ) : null}
          <Text
            style={[
              styles.label,
              { color: FG[variant], fontSize: size === "md" ? type.lg : type.xl },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 58,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  btnMd: { height: 46 },
  outline: { borderWidth: 2, borderColor: colors.borderStrong },
  row: { flexDirection: "row", alignItems: "center" },
  label: { fontFamily: font.display },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.97 }] },
});
