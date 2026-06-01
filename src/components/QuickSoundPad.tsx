import { FontAwesome5 } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { QuickEffect } from "../types/audio";
import { colors } from "../theme/colors";

type Props = {
  effect: QuickEffect;
  hasAudio: boolean;
  columns?: number;
  large?: boolean;
  readOnly?: boolean;
  onPlay: () => void;
  onImport: () => void;
};

export function QuickSoundPad({ effect, hasAudio, columns = 4, large, readOnly, onPlay, onImport }: Props) {
  const sourceLabel = hasAudio ? "Local" : "Vide";

  return (
    <View style={[styles.wrap, { width: `${100 / columns}%` }]}>
      <Pressable
        accessibilityRole="button"
        disabled={!hasAudio}
        onPress={onPlay}
        onLongPress={onImport}
        style={({ pressed }) => [
          styles.pad,
          large && styles.largePad,
          { borderColor: `${effect.accent}99` },
          !hasAudio && styles.disabled,
          pressed && hasAudio && styles.pressed
        ]}
      >
        <FontAwesome5 name={effect.icon as never} size={18} color={effect.accent} />
        <Text numberOfLines={2} adjustsFontSizeToFit style={styles.title}>
          {effect.title}
        </Text>
        <Text style={[styles.sourceBadge, hasAudio && styles.sourceLocal]}>
          {sourceLabel}
        </Text>
      </Pressable>
      {!readOnly ? (
        <Pressable accessibilityRole="button" onPress={onImport} style={styles.importButton}>
          <Text style={styles.importText}>{hasAudio ? "Changer" : "Ajouter"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "25%",
    padding: 4
  },
  pad: {
    height: 86,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    gap: 8
  },
  largePad: {
    height: 108
  },
  disabled: {
    opacity: 0.52
  },
  pressed: {
    transform: [{ scale: 0.96 }],
    backgroundColor: colors.surfaceSoft
  },
  title: {
    minHeight: 22,
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0
  },
  sourceBadge: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0
  },
  sourceLocal: {
    color: colors.gold
  },
  importButton: {
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  importText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700"
  }
});
