import { FontAwesome5 } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AmbientCategory } from "../types/audio";
import { colors } from "../theme/colors";
import { AppButton } from "./AppButton";

type Props = {
  category: AmbientCategory;
  hasAudio: boolean;
  externalLabel?: string;
  isPlaying: boolean;
  favorite: boolean;
  onTogglePlay: () => void;
  onImport: () => void;
  onAttachExternalLink: () => void;
  onToggleFavorite: () => void;
};

export function CategoryCard({
  category,
  hasAudio,
  externalLabel,
  isPlaying,
  favorite,
  onTogglePlay,
  onImport,
  onAttachExternalLink,
  onToggleFavorite
}: Props) {
  const canLaunch = hasAudio || Boolean(externalLabel);

  return (
    <View style={[styles.card, { borderColor: `${category.accent}88` }]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${category.accent}22` }]}>
          <FontAwesome5 name={category.icon as never} size={18} color={category.accent} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{category.title}</Text>
          <Text numberOfLines={2} style={styles.description}>
            {category.description}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onToggleFavorite} style={styles.favorite}>
          <FontAwesome5 name="star" solid={favorite} size={17} color={favorite ? colors.gold : colors.muted} />
        </Pressable>
      </View>
      <View style={styles.actions}>
        <AppButton
          compact
          icon={externalLabel && !hasAudio ? "external-link-alt" : isPlaying ? "pause" : "play"}
          label={externalLabel && !hasAudio ? externalLabel : isPlaying ? "Pause" : "Lancer"}
          tone={canLaunch ? "primary" : "secondary"}
          disabled={!canLaunch}
          onPress={onTogglePlay}
          style={styles.actionButton}
        />
        <AppButton compact icon="file-audio" label={hasAudio ? "Remplacer" : "Associer"} onPress={onImport} style={styles.actionButton} />
        <AppButton compact icon="link" label={externalLabel ? "Changer lien" : "Lien web"} onPress={onAttachExternalLink} style={styles.actionButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "48%",
    minHeight: 164,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: 12,
    justifyContent: "space-between",
    shadowColor: colors.shadow,
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  titleBlock: {
    flex: 1
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0
  },
  description: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0
  },
  favorite: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  actions: {
    marginTop: 12,
    gap: 8
  },
  actionButton: {
    width: "100%"
  }
});
