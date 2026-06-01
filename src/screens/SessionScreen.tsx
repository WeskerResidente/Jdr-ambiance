import React, { useState } from "react";
import { FontAwesome5 } from "@expo/vector-icons";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton } from "../components/AppButton";
import { ambientCategories, quickEffects } from "../data/categories";
import { externalButtonLabel } from "../utils/links";
import { CampaignImage, CustomSound, ExternalAudioLink, SoundAsset, SoundFolder } from "../types/audio";
import { colors } from "../theme/colors";

interface SessionScreenProps {
  selectedFolderId: string;
  soundFolders: SoundFolder[];
  scenes: any[];
  customSounds: CustomSound[];
  campaignImages: CampaignImage[];
  categorySounds: Record<string, SoundAsset | undefined>;
  categoryExternalLinks: Record<string, ExternalAudioLink | undefined>;
  quickSounds: Record<string, SoundAsset | undefined>;
  customSoundAssets: Record<string, SoundAsset | undefined>;
  activeLoopIds: string[];
  onPlayScene: (scene: any) => Promise<void>;
  onToggleCategoryPlayback: (categoryId: string) => Promise<void>;
  onPlayGeneralQuickEffect: (effectId: string) => Promise<void>;
  onPlayQuickSound: (soundId: string) => Promise<void>;
  onToggleAmbiance: (soundId: string) => void;
  onStopAll: () => Promise<void>;
  onExit: () => void;
}

export function SessionScreen(props: SessionScreenProps) {
  const insets = useSafeAreaInsets();
  const [imageFolderOpen, setImageFolderOpen] = useState(false);
  const [imageSearch, setImageSearch] = useState("");
  const [previewImage, setPreviewImage] = useState<CampaignImage | null>(null);
  const folderScenes = props.selectedFolderId 
    ? props.scenes.filter(s => s.folderId === props.selectedFolderId) 
    : [];
  const folderAmbiences = props.selectedFolderId 
    ? props.customSounds.filter(s => s.folderId === props.selectedFolderId && s.kind === "ambient") 
    : [];
  const folderQuickSounds = props.selectedFolderId 
    ? props.customSounds.filter(s => s.folderId === props.selectedFolderId && s.kind === "quick") 
    : [];
  const playableGlobalAmbiences = ambientCategories.filter(
    (category) => props.categorySounds[category.id] || props.categoryExternalLinks[category.id]
  );
  const playableGlobalQuickSounds = quickEffects.filter(
    (effect) => props.quickSounds[effect.id]
  );
  const folderImages = props.selectedFolderId
    ? props.campaignImages.filter((image) => image.folderId === props.selectedFolderId)
    : [];
  const visibleFolderImages = folderImages.filter((image) => {
    const query = imageSearch.trim().toLowerCase();
    if (!query) return true;

    return `${image.title} ${image.fileName ?? ""}`.toLowerCase().includes(query);
  });

  const folderName = props.soundFolders.find(f => f.id === props.selectedFolderId)?.name || "Session";

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{folderName}</Text>
        <Text style={styles.subtitle}>
          {props.activeLoopIds.length} son(s) en cours
        </Text>
      </View>

      {/* Bouton STOP énorme */}
      <View style={styles.stopSection}>
        <Pressable 
          onPress={props.onStopAll}
          style={styles.stopButton}
        >
          <FontAwesome5 name="stop" size={48} color="white" />
          <Text style={styles.stopButtonText}>STOP</Text>
        </Pressable>
      </View>

      {/* Scènes - gros boutons */}
      <View style={styles.imageSection}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setImageFolderOpen((value) => !value)}
          style={styles.imageFolderCard}
        >
          <View style={styles.imageFolderIcon}>
            <FontAwesome5 name={imageFolderOpen ? "folder-open" : "folder"} size={24} color={colors.gold} />
          </View>
          <View style={styles.imageFolderCopy}>
            <Text style={styles.imageFolderTitle}>Images</Text>
            <Text style={styles.imageFolderMeta}>{folderImages.length} image(s) dans cette campagne</Text>
          </View>
          <FontAwesome5 name={imageFolderOpen ? "chevron-up" : "chevron-down"} size={16} color="#999" />
        </Pressable>

        {imageFolderOpen ? (
          <View style={styles.imageFolderContent}>
            <TextInput
              value={imageSearch}
              onChangeText={setImageSearch}
              placeholder="Rechercher une image..."
              placeholderTextColor="#999"
              autoCapitalize="none"
              style={styles.imageSearchInput}
            />
            {folderImages.length > 0 ? (
              <View style={styles.imageGrid}>
                {visibleFolderImages.map((image) => (
                  <Pressable
                    key={image.id}
                    accessibilityRole="imagebutton"
                    onPress={() => setPreviewImage(image)}
                    style={styles.imageCard}
                  >
                    <Image source={{ uri: image.uri }} style={styles.campaignImage} resizeMode="cover" />
                    <View style={styles.imageCopy}>
                      <Text numberOfLines={1} style={styles.imageTitle}>{image.title}</Text>
                      <Text style={styles.imageMeta}>{image.source === "local" ? "Image locale" : "Lien externe"}</Text>
                    </View>
                  </Pressable>
                ))}
                {visibleFolderImages.length === 0 ? (
                  <Text style={styles.empty}>Aucune image ne correspond a la recherche.</Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.empty}>Aucune image dans ce dossier.</Text>
            )}
          </View>
        ) : null}
      </View>

      {playableGlobalQuickSounds.length > 0 ? (
        <View style={styles.quickSection}>
          <Text style={styles.sectionTitle}>Sons rapides generaux</Text>
          <View style={styles.quickGrid}>
            {playableGlobalQuickSounds.map((effect) => (
              <Pressable
                key={effect.id}
                onPress={() => props.onPlayGeneralQuickEffect(effect.id)}
                style={styles.quickButton}
              >
                <FontAwesome5 name={effect.icon as never} size={32} color={effect.accent} />
                <Text numberOfLines={2} style={styles.quickButtonText}>{effect.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {playableGlobalAmbiences.length > 0 ? (
        <View style={styles.ambianceSection}>
          <Text style={styles.sectionTitle}>Ambiances generales</Text>
          {playableGlobalAmbiences.map((category) => {
            const sound = props.categorySounds[category.id];
            const externalLink = props.categoryExternalLinks[category.id];
            const isPlaying = Boolean(sound && props.activeLoopIds.includes(sound.id));
            return (
              <Pressable
                key={category.id}
                onPress={() => props.onToggleCategoryPlayback(category.id)}
                style={[styles.ambianceButton, isPlaying && styles.ambianceButtonActive]}
              >
                <FontAwesome5
                  name={category.icon as never}
                  size={24}
                  color={isPlaying ? colors.gold : category.accent}
                />
                <View style={styles.sessionSoundCopy}>
                  <Text style={styles.ambianceButtonText}>{category.title}</Text>
                  {externalLink && !sound ? (
                    <Text style={styles.sourceText}>{externalButtonLabel(externalLink.provider)}</Text>
                  ) : null}
                </View>
                <FontAwesome5
                  name={externalLink && !sound ? "external-link-alt" : isPlaying ? "pause-circle" : "play-circle"}
                  size={18}
                  color={isPlaying ? colors.gold : "#999"}
                />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {folderScenes.length > 0 ? (
        <View style={styles.sceneSection}>
          <Text style={styles.sectionTitle}>Scènes</Text>
          {folderScenes.map((scene) => (
            <Pressable
              key={scene.id}
              onPress={() => props.onPlayScene(scene)}
              style={styles.sceneButton}
            >
              <FontAwesome5 name="bookmark" size={24} color={colors.gold} />
              <Text style={styles.sceneButtonText}>{scene.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Sons rapides - grille */}
      {folderQuickSounds.length > 0 ? (
        <View style={styles.quickSection}>
          <Text style={styles.sectionTitle}>Sons rapides</Text>
          <View style={styles.quickGrid}>
            {folderQuickSounds.map((item) => {
              const asset = props.customSoundAssets[item.id];
              const isPlaying = asset && props.activeLoopIds.includes(asset.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => props.onPlayQuickSound(item.id)}
                  style={[
                    styles.quickButton,
                    isPlaying && styles.quickButtonActive
                  ]}
                >
                  <FontAwesome5 
                    name={item.icon} 
                    size={32} 
                    color={isPlaying ? colors.gold : item.accent}
                  />
                  <Text numberOfLines={2} style={styles.quickButtonText}>{item.title}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Ambiances */}
      {folderAmbiences.length > 0 ? (
        <View style={styles.ambianceSection}>
          <Text style={styles.sectionTitle}>Ambiances</Text>
          {folderAmbiences.map((item) => {
            const asset = props.customSoundAssets[item.id];
            const isPlaying = asset && props.activeLoopIds.includes(asset.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => props.onToggleAmbiance(item.id)}
                style={[styles.ambianceButton, isPlaying && styles.ambianceButtonActive]}
              >
                <FontAwesome5
                  name={item.icon as never}
                  size={24}
                  color={isPlaying ? colors.gold : item.accent}
                  style={{ opacity: isPlaying ? 1 : 0.6 }}
                />
                <View style={styles.sessionSoundCopy}>
                  <Text style={styles.ambianceButtonText}>{item.title}</Text>
                  {item.section?.trim() ? (
                    <Text numberOfLines={3} style={styles.ambianceDescription}>{item.section.trim()}</Text>
                  ) : null}
                </View>
                <FontAwesome5
                  name={item.externalLink && !asset ? "external-link-alt" : isPlaying ? "pause-circle" : "play-circle"}
                  size={18}
                  color={isPlaying ? colors.gold : "#999"}
                />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Bouton Retour à la Gestion */}
      <View style={styles.footer}>
        <AppButton
          label="Retour à la gestion"
          icon="cog"
          tone="secondary"
          onPress={props.onExit}
        />
      </View>
    </ScrollView>
    <Modal visible={Boolean(previewImage)} animationType="fade" onRequestClose={() => setPreviewImage(null)}>
      <View style={styles.imagePreviewScreen}>
        <Pressable accessibilityRole="button" onPress={() => setPreviewImage(null)} style={styles.imagePreviewClose}>
          <FontAwesome5 name="times" size={20} color="#fff" />
        </Pressable>
        {previewImage ? (
          <>
            <Image source={{ uri: previewImage.uri }} style={styles.imagePreview} resizeMode="contain" />
            <Text numberOfLines={2} style={styles.imagePreviewTitle}>{previewImage.title}</Text>
          </>
        ) : null}
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  header: {
    padding: 20,
    backgroundColor: "#0d0d0d",
    borderBottomWidth: 1,
    borderBottomColor: colors.gold,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: colors.gold,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#999",
  },
  stopSection: {
    padding: 20,
    alignItems: "center",
  },
  stopButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#c41e3a",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  stopButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 8,
  },
  imageSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  imageFolderCard: {
    minHeight: 78,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    backgroundColor: "#2a2a2a",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
  },
  imageFolderIcon: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: "#3a3a2a",
    alignItems: "center",
    justifyContent: "center",
  },
  imageFolderCopy: {
    flex: 1,
  },
  imageFolderTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  imageFolderMeta: {
    marginTop: 4,
    color: "#999",
    fontWeight: "600",
  },
  imageFolderContent: {
    gap: 10,
  },
  imageSearchInput: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333",
    backgroundColor: "#0d0d0d",
    color: "#fff",
    paddingHorizontal: 12,
    fontWeight: "700",
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  imageCard: {
    width: "48%",
    minHeight: 164,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    backgroundColor: "#2a2a2a",
    overflow: "hidden",
  },
  campaignImage: {
    width: "100%",
    height: 112,
    backgroundColor: "#0d0d0d",
  },
  imageCopy: {
    padding: 10,
    gap: 4,
  },
  imageTitle: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },
  imageMeta: {
    color: "#999",
    fontSize: 12,
    fontWeight: "600",
  },
  imagePreviewScreen: {
    flex: 1,
    backgroundColor: "#050505",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  imagePreviewClose: {
    position: "absolute",
    top: 18,
    right: 18,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
    backgroundColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePreview: {
    width: "100%",
    height: "82%",
  },
  imagePreviewTitle: {
    marginTop: 14,
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  sceneSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.gold,
    marginBottom: 12,
  },
  sceneButton: {
    flexDirection: "row",
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#333",
    elevation: 4,
  },
  sceneButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 12,
    flex: 1,
  },
  quickSection: {
    padding: 16,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  quickButton: {
    width: "47%",
    aspectRatio: 1,
    backgroundColor: "#2a2a2a",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
    borderWidth: 2,
    borderColor: "#333",
  },
  quickButtonActive: {
    backgroundColor: "#3a3a2a",
    borderColor: colors.gold,
  },
  quickButtonText: {
    fontSize: 12,
    color: "#fff",
    textAlign: "center",
    marginTop: 8,
  },
  sourceText: {
    color: "#999",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  ambianceSection: {
    padding: 16,
  },
  ambianceButton: {
    flexDirection: "row",
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  ambianceButtonActive: {
    backgroundColor: "#3a3a2a",
    borderColor: colors.gold,
  },
  ambianceButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "700",
  },
  ambianceDescription: {
    marginTop: 4,
    color: "#999",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  sessionSoundCopy: {
    flex: 1,
    marginLeft: 12,
  },
  footer: {
    padding: 16,
    marginBottom: 20,
  },
  empty: {
    color: "#999",
    fontWeight: "600",
  },
});
