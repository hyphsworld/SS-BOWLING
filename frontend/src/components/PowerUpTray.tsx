import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, radius, spacing, type } from "@/src/theme/theme";
import { POWERUPS, PowerUpId } from "@/src/game/powerups";
import { playSound } from "@/src/audio/sounds";

interface Props {
  energy: number; // 0..100
  armed: PowerUpId | null;
  onArm: (id: PowerUpId | null) => void;
  disabled?: boolean;
}

export default function PowerUpTray({ energy, armed, onArm, disabled }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.energyRow}>
        <Ionicons name="flash" size={16} color={colors.brandSecondary} />
        <View style={styles.energyTrack}>
          <View
            style={[
              styles.energyFill,
              { width: `${energy}%`, backgroundColor: colors.brandSecondary },
            ]}
          />
        </View>
        <Text style={styles.energyText}>{Math.round(energy)}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {POWERUPS.map((p) => {
          const affordable = energy >= p.cost;
          const isArmed = armed === p.id;
          return (
            <Pressable
              key={p.id}
              testID={`powerup-${p.id}`}
              disabled={disabled || (!affordable && !isArmed)}
              onPress={() => {
                playSound("tap");
                onArm(isArmed ? null : p.id);
              }}
              style={[
                styles.chip,
                { borderColor: isArmed ? p.color : "rgba(34,225,255,0.3)" },
                isArmed && { backgroundColor: p.color },
                !affordable && !isArmed && styles.chipDisabled,
              ]}
            >
              <Ionicons
                name={p.icon as any}
                size={20}
                color={isArmed ? (p.id === "bomb" ? "#fff" : colors.onSurface) : p.color}
              />
              <Text
                style={[
                  styles.chipLabel,
                  isArmed && { color: p.id === "bomb" ? "#fff" : colors.onSurface },
                ]}
              >
                {p.short}
              </Text>
              <View style={styles.costRow}>
                <Ionicons
                  name="flash"
                  size={9}
                  color={isArmed ? (p.id === "bomb" ? "#fff" : colors.onSurface) : "rgba(234,247,255,0.7)"}
                />
                <Text
                  style={[
                    styles.costText,
                    isArmed && { color: p.id === "bomb" ? "#fff" : colors.onSurface },
                  ]}
                >
                  {p.cost}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  energyRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  energyTrack: {
    flex: 1,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: "rgba(2,8,24,0.8)",
    borderWidth: 1,
    borderColor: "rgba(34,225,255,0.25)",
    overflow: "hidden",
  },
  energyFill: { height: "100%", borderRadius: radius.pill },
  energyText: {
    fontFamily: font.display,
    fontSize: type.sm,
    color: "#EAF7FF",
    width: 26,
    textAlign: "right",
  },
  chips: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    width: 66,
    height: 66,
    borderRadius: radius.md,
    borderWidth: 2,
    backgroundColor: "rgba(6,14,40,0.85)",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    flexShrink: 0,
  },
  chipDisabled: { opacity: 0.4 },
  chipLabel: { fontFamily: font.display, fontSize: 11, color: "#EAF7FF" },
  costRow: { flexDirection: "row", alignItems: "center", gap: 1 },
  costText: {
    fontFamily: font.text,
    fontSize: 9,
    color: "rgba(234,247,255,0.7)",
  },
});
