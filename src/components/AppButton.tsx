import { FontAwesome5 } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors } from "../theme/colors";

type Props = {
  label: string;
  icon?: string;
  tone?: "primary" | "secondary" | "danger";
  compact?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  onPress: () => void;
};

export function AppButton({ label, icon, tone = "secondary", compact, disabled, style, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        tone === "primary" && styles.primary,
        tone === "danger" && styles.danger,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style
      ]}
    >
      {icon ? <FontAwesome5 name={icon as never} size={compact ? 13 : 16} color={colors.text} /> : null}
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  compact: {
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  primary: {
    backgroundColor: "#7d5a22",
    borderColor: colors.gold
  },
  danger: {
    backgroundColor: "#5b262d",
    borderColor: colors.red
  },
  disabled: {
    opacity: 0.45
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.88
  },
  label: {
    color: colors.text,
    fontWeight: "700",
    letterSpacing: 0
  }
});
