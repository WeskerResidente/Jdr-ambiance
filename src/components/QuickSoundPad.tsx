import { FontAwesome5 } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { QuickEffect } from "../types/audio";
import { colors } from "../theme/colors";

type Props = {
  effect: QuickEffect;
  hasAudio: boolean;
  externalLabel?: string;
  onPlay: () => void;
  onImport: () => void;
  onAttachExternalLink: () => void;
};

export function QuickSoundPad({ effect, hasAudio, externalLabel, onPlay, onImport, onAttachExternalLink }: Props) {
  const canLaunch = hasAudio || Boolean(externalLabel);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        disabled={!canLaunch}
        onPress={onPlay}
        onLongPress={onImport}
        style={({ pressed }) => [
          styles.pad,
          { borderColor: `${effect.accent}99` },
          !canLaunch && styles.disabled,
          pressed && canLaunch && styles.pressed
        ]}
      >
        <FontAwesome5 name={externalLabel && !hasAudio ? "external-link-alt" : (effect.icon as never)} size={18} color={effect.accent} />
        <Text numberOfLines={2} adjustsFontSizeToFit style={styles.title}>
          {effect.title}
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onImport} style={styles.importButton}>
        <Text style={styles.importText}>{hasAudio ? "Changer" : "Ajouter"}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onAttachExternalLink} style={styles.importButton}>
        <Text style={styles.importText}>{externalLabel ? "Lien" : "Web"}</Text>
      </Pressable>
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
  disabled: {
    opacity: 0.52
  },
  pressed: {
    transform: [{ scale: 0.96 }],
    backgroundColor: colors.surfaceSoft
  },
  title: {
    minHeight: 30,
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0
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
