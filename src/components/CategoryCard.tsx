import { FontAwesome5 } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { AmbientCategory } from "../types/audio";
import { colors } from "../theme/colors";
import { AppButton } from "./AppButton";

type Props = {
  category: AmbientCategory;
  hasAudio: boolean;
  externalLabel?: string;
  isPlaying: boolean;
  favorite: boolean;
  readOnly?: boolean;
  allowSourceReplacement?: boolean;
  singleAddAction?: boolean;
  onTogglePlay: () => void;
  onImport: () => void;
  onAttachExternalLink: () => void;
  onDeleteAudio?: () => void;
  onDeleteExternalLink?: () => void;
  onToggleFavorite: () => void;
  onOpenDetails?: () => void;
  style?: ViewStyle;
};

export function CategoryCard({
  category,
  hasAudio,
  externalLabel,
  isPlaying,
  favorite,
  readOnly,
  allowSourceReplacement = true,
  singleAddAction,
  onTogglePlay,
  onImport,
  onAttachExternalLink,
  onDeleteAudio,
  onDeleteExternalLink,
  onToggleFavorite,
  onOpenDetails,
  style
}: Props) {
  const canLaunch = hasAudio || Boolean(externalLabel);
  const canAddSource = allowSourceReplacement || !canLaunch;

  return (
    <View style={[styles.card, { borderColor: `${category.accent}88` }, style]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onOpenDetails} disabled={!onOpenDetails} style={styles.detailsTarget}>
          <View style={[styles.iconWrap, { backgroundColor: `${category.accent}22` }]}>
            <FontAwesome5 name={category.icon as never} size={18} color={category.accent} />
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{category.title}</Text>
            <Text numberOfLines={2} style={styles.description}>
              {category.description}
            </Text>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onToggleFavorite} style={styles.favorite}>
          <FontAwesome5 name="star" solid={favorite} size={17} color={favorite ? colors.gold : colors.muted} />
        </Pressable>
      </View>
      <View style={styles.actions}>
        <AppButton
          compact
          icon={externalLabel && !hasAudio ? undefined : isPlaying ? "pause" : "play"}
          label={externalLabel && !hasAudio ? externalLabel : isPlaying ? "Pause" : "Lancer"}
          tone={canLaunch ? "primary" : "secondary"}
          disabled={!canLaunch}
          onPress={onTogglePlay}
          style={styles.actionButton}
        />
        {!readOnly && canAddSource && singleAddAction ? (
          <AppButton compact icon="plus" label="Ajouter un son" onPress={onImport} style={styles.actionButton} />
        ) : null}
        {!readOnly && canAddSource && !singleAddAction ? (
          <AppButton compact label={hasAudio ? "Remplacer" : "Associer"} onPress={onImport} style={styles.actionButton} />
        ) : null}
        {!readOnly && canAddSource && !singleAddAction ? (
          <AppButton compact label={externalLabel ? "Changer lien" : "Lien web"} onPress={onAttachExternalLink} style={styles.actionButton} />
        ) : null}
        {!readOnly && !allowSourceReplacement && hasAudio && onDeleteAudio ? (
          <AppButton compact icon="trash" label="Supprimer son" tone="danger" onPress={onDeleteAudio} style={styles.actionButton} />
        ) : null}
        {!readOnly && !allowSourceReplacement && externalLabel && onDeleteExternalLink ? (
          <AppButton compact icon="unlink" label="Supprimer lien" tone="danger" onPress={onDeleteExternalLink} style={styles.actionButton} />
        ) : null}
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
  detailsTarget: {
    flex: 1,
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
    width: "100%",
    minHeight: 44,
    paddingHorizontal: 8
  }
});
