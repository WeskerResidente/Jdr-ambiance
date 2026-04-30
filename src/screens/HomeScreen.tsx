import React, { useEffect, useMemo, useRef, useState } from "react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { ambientCategories, quickEffects } from "../data/categories";
import { defaultMixerState, trackLabels } from "../data/mixer";
import { AppButton } from "../components/AppButton";
import { CategoryCard } from "../components/CategoryCard";
import { QuickSoundPad } from "../components/QuickSoundPad";
import { Section } from "../components/Section";
import { VolumeStepper } from "../components/VolumeStepper";
import { SPOTIFY_CLIENT_ID } from "../config/spotify";
import { audioService } from "../services/audioService";
import { importAudioFile } from "../services/importService";
import {
  getSpotifyDevices,
  getSpotifyProfile,
  isSpotifyTokenFresh,
  pauseSpotifyPlayback,
  setSpotifyVolume,
  spotifyUriFromUrl,
  startSpotifyPlayback,
  transferSpotifyPlayback
} from "../services/spotifyService";
import { storageService } from "../services/storageService";
import { colors } from "../theme/colors";
import { ExternalAudioLink, MixerState, Scene, SceneSound, SoundAsset, SpotifyDevice, SpotifyTokens, TrackType } from "../types/audio";
import { detectExternalProvider, externalButtonLabel, openExternalLink } from "../utils/links";

WebBrowser.maybeCompleteAuthSession();

const trackOrder: TrackType[] = ["ambient", "music", "sfx", "special"];
const spotifyDiscovery = {
  authorizationEndpoint: "https://accounts.spotify.com/authorize",
  tokenEndpoint: "https://accounts.spotify.com/api/token"
};
const spotifyScopes = ["user-read-private", "user-read-playback-state", "user-modify-playback-state"];

function latestItem<T>(items: T[]) {
  return items.length > 0 ? items[items.length - 1] : undefined;
}

export function HomeScreen() {
  const [sounds, setSounds] = useState<SoundAsset[]>([]);
  const [externalLinks, setExternalLinks] = useState<ExternalAudioLink[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [favoriteCategories, setFavoriteCategories] = useState<string[]>([]);
  const [activeLoopIds, setActiveLoopIds] = useState<string[]>([]);
  const [globalVolume, setGlobalVolume] = useState(0.85);
  const [mixer, setMixer] = useState<MixerState>(defaultMixerState);
  const [spotifyClientId, setSpotifyClientId] = useState(SPOTIFY_CLIENT_ID);
  const [spotifyTokens, setSpotifyTokens] = useState<SpotifyTokens | null>(null);
  const [spotifyProfileName, setSpotifyProfileName] = useState("");
  const [spotifyConfigOpen, setSpotifyConfigOpen] = useState(false);
  const [spotifyDevices, setSpotifyDevices] = useState<SpotifyDevice[]>([]);
  const [selectedSpotifyDeviceId, setSelectedSpotifyDeviceId] = useState("");
  const [spotifyDevicesLoading, setSpotifyDevicesLoading] = useState(false);
  const [sceneModalVisible, setSceneModalVisible] = useState(false);
  const [sceneName, setSceneName] = useState("");
  const [sceneDescription, setSceneDescription] = useState("");
  const [sceneLink, setSceneLink] = useState("");
  const [transitionMinutes, setTransitionMinutes] = useState("");
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkTarget, setLinkTarget] = useState<{ type: "category" | "quick"; id: string; title: string } | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spotifyRedirectUri = AuthSession.makeRedirectUri({
    scheme: "jdrambiances",
    path: "spotify-auth"
  });
  const [spotifyRequest, spotifyResponse, promptSpotifyAsync] = AuthSession.useAuthRequest(
    {
      clientId: spotifyClientId.trim() || "missing-client-id",
      redirectUri: spotifyRedirectUri,
      responseType: AuthSession.ResponseType.Code,
      scopes: spotifyScopes,
      usePKCE: true
    },
    spotifyDiscovery
  );

  useEffect(() => {
    async function bootstrap() {
      const [
        storedSounds,
        storedExternalLinks,
        storedScenes,
        storedMixer,
        storedFavorites,
        storedSpotifyClientId,
        storedSpotifyTokens,
        storedSpotifyDeviceId
      ] = await Promise.all([
        storageService.getSounds(),
        storageService.getExternalAudioLinks(),
        storageService.getScenes(),
        storageService.getMixer(),
        storageService.getFavoriteCategories(),
        storageService.getSpotifyClientId(),
        storageService.getSpotifyTokens(),
        storageService.getSpotifyDeviceId()
      ]);
      setSounds(storedSounds);
      setExternalLinks(storedExternalLinks);
      setScenes(storedScenes);
      setMixer(storedMixer);
      setFavoriteCategories(storedFavorites);
      setSpotifyClientId(SPOTIFY_CLIENT_ID || storedSpotifyClientId);
      setSpotifyTokens(storedSpotifyTokens);
      setSelectedSpotifyDeviceId(storedSpotifyDeviceId);
      audioService.setMixer(storedMixer);
      audioService.setGlobalVolume(globalVolume);
      await audioService.configure();
    }

    bootstrap();

    return () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      audioService.stopAllLoops();
    };
  }, []);

  useEffect(() => {
    async function finishSpotifyLogin() {
      if (spotifyResponse?.type !== "success" || !spotifyClientId.trim() || !spotifyRequest?.codeVerifier) return;

      try {
        const tokenResponse = await AuthSession.exchangeCodeAsync(
          {
            clientId: spotifyClientId.trim(),
            code: spotifyResponse.params.code,
            redirectUri: spotifyRedirectUri,
            extraParams: {
              code_verifier: spotifyRequest.codeVerifier
            }
          },
          spotifyDiscovery
        );

        const nextTokens: SpotifyTokens = {
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken,
          expiresIn: tokenResponse.expiresIn,
          issuedAt: tokenResponse.issuedAt
        };

        setSpotifyTokens(nextTokens);
        await storageService.saveSpotifyTokens(nextTokens);
        const profile = await getSpotifyProfile(nextTokens.accessToken);
        setSpotifyProfileName(profile.display_name ?? profile.id);
        await refreshSpotifyDevices(nextTokens);
      } catch (error) {
        Alert.alert("Connexion Spotify impossible", error instanceof Error ? error.message : "Erreur inconnue.");
      }
    }

    finishSpotifyLogin();
  }, [spotifyResponse, spotifyClientId, spotifyRedirectUri, spotifyRequest?.codeVerifier]);

  useEffect(() => {
    async function loadSpotifyProfile() {
      if (!spotifyTokens?.accessToken || !isSpotifyTokenFresh(spotifyTokens)) return;

      try {
        const profile = await getSpotifyProfile(spotifyTokens.accessToken);
        setSpotifyProfileName(profile.display_name ?? profile.id);
        await refreshSpotifyDevices(spotifyTokens);
      } catch {
        setSpotifyProfileName("");
      }
    }

    loadSpotifyProfile();
  }, [spotifyTokens]);

  const categorySounds = useMemo(() => {
    return ambientCategories.reduce<Record<string, SoundAsset | undefined>>((acc, category) => {
      acc[category.id] = latestItem(sounds.filter((sound) => sound.categoryId === category.id));
      return acc;
    }, {});
  }, [sounds]);

  const quickSounds = useMemo(() => {
    return quickEffects.reduce<Record<string, SoundAsset | undefined>>((acc, effect) => {
      acc[effect.id] = latestItem(sounds.filter((sound) => sound.quickEffectId === effect.id));
      return acc;
    }, {});
  }, [sounds]);

  const categoryExternalLinks = useMemo(() => {
    return ambientCategories.reduce<Record<string, ExternalAudioLink | undefined>>((acc, category) => {
      acc[category.id] = latestItem(externalLinks.filter((link) => link.categoryId === category.id));
      return acc;
    }, {});
  }, [externalLinks]);

  const quickExternalLinks = useMemo(() => {
    return quickEffects.reduce<Record<string, ExternalAudioLink | undefined>>((acc, effect) => {
      acc[effect.id] = latestItem(externalLinks.filter((link) => link.quickEffectId === effect.id));
      return acc;
    }, {});
  }, [externalLinks]);

  const favoriteScenes = scenes.filter((scene) => scene.favorite);
  const selectedSpotifyDevice = spotifyDevices.find((device) => device.id === selectedSpotifyDeviceId);

  async function persistSounds(nextSounds: SoundAsset[]) {
    setSounds(nextSounds);
    await storageService.saveSounds(nextSounds);
  }

  async function persistExternalLinks(nextLinks: ExternalAudioLink[]) {
    setExternalLinks(nextLinks);
    await storageService.saveExternalAudioLinks(nextLinks);
  }

  async function persistScenes(nextScenes: Scene[]) {
    setScenes(nextScenes);
    await storageService.saveScenes(nextScenes);
  }

  async function importForCategory(categoryId: string) {
    const category = ambientCategories.find((item) => item.id === categoryId);
    const asset = await importAudioFile({
      title: `Ambiance - ${category?.title ?? "JDR"}`,
      track: "ambient",
      categoryId
    });
    if (asset) await persistSounds([...sounds, asset]);
  }

  async function importForQuickEffect(effectId: string) {
    const effect = quickEffects.find((item) => item.id === effectId);
    const asset = await importAudioFile({
      title: effect?.title ?? "Son rapide",
      track: "sfx",
      quickEffectId: effectId
    });
    if (asset) await persistSounds([...sounds, asset]);
  }

  async function toggleCategoryPlayback(categoryId: string) {
    const sound = categorySounds[categoryId];
    const externalLink = categoryExternalLinks[categoryId];
    if (!sound) {
      await playExternalAudioLink(externalLink);
      return;
    }

    if (activeLoopIds.includes(sound.id)) {
      await audioService.stopLoop(sound.id);
      setActiveLoopIds((ids) => ids.filter((id) => id !== sound.id));
    } else {
      await audioService.playLoop(sound, 1);
      setActiveLoopIds((ids) => [...ids, sound.id]);
    }
  }

  async function playQuickEffect(effectId: string) {
    const sound = quickSounds[effectId];
    if (sound) {
      await audioService.playOneShot(sound, 1);
      return;
    }

    await playExternalAudioLink(quickExternalLinks[effectId]);
  }

  async function playExternalAudioLink(link?: ExternalAudioLink) {
    if (!link?.url) return;

    if (link.provider === "spotify" && spotifyTokens?.accessToken && isSpotifyTokenFresh(spotifyTokens)) {
      const spotifyUri = spotifyUriFromUrl(link.url);
      if (spotifyUri) {
        try {
          await ensureSelectedSpotifyDevice();
          await startSpotifyPlayback(spotifyTokens.accessToken, spotifyUri, selectedSpotifyDeviceId || undefined);
          await updateSpotifyMixerVolume(mixer.music, globalVolume);
          return;
        } catch {
          Alert.alert(
            "Lecture Spotify impossible",
            "Ouvre Spotify sur ton téléphone, lance une lecture une fois, puis réessaie. Spotify Premium est requis pour le contrôle à distance."
          );
        }
      }
    }

    await openExternalLink(link.url);
  }

  function openExternalLinkModal(target: { type: "category" | "quick"; id: string; title: string }) {
    const currentLink =
      target.type === "category"
        ? categoryExternalLinks[target.id]
        : quickExternalLinks[target.id];
    setLinkTarget(target);
    setExternalUrl(currentLink?.url ?? "");
    setLinkModalVisible(true);
  }

  async function saveExternalLink() {
    if (!linkTarget) return;
    const cleanUrl = externalUrl.trim();

    if (!cleanUrl) {
      Alert.alert("Lien requis", "Ajoute une URL Spotify, YouTube ou une autre source externe.");
      return;
    }

    if (!/^https?:\/\//i.test(cleanUrl)) {
      Alert.alert("Lien invalide", "Le lien doit commencer par http:// ou https://.");
      return;
    }

    const withoutCurrent = externalLinks.filter((link) => {
      if (linkTarget.type === "category") return link.categoryId !== linkTarget.id;
      return link.quickEffectId !== linkTarget.id;
    });

    const nextLink: ExternalAudioLink = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: linkTarget.title,
      url: cleanUrl,
      provider: detectExternalProvider(cleanUrl),
      categoryId: linkTarget.type === "category" ? linkTarget.id : undefined,
      quickEffectId: linkTarget.type === "quick" ? linkTarget.id : undefined,
      createdAt: new Date().toISOString()
    };

    await persistExternalLinks([...withoutCurrent, nextLink]);
    setExternalUrl("");
    setLinkTarget(null);
    setLinkModalVisible(false);
  }

  async function updateMixer(track: TrackType, value: number) {
    const nextMixer = { ...mixer, [track]: value };
    setMixer(nextMixer);
    audioService.setMixer(nextMixer);
    await storageService.saveMixer(nextMixer);

    if (track === "music") {
      await updateSpotifyMixerVolume(value, globalVolume);
    }
  }

  function updateGlobalVolume(value: number) {
    setGlobalVolume(value);
    audioService.setGlobalVolume(value);
    updateSpotifyMixerVolume(mixer.music, value, true);
  }

  async function updateSpotifyMixerVolume(musicVolume: number, nextGlobalVolume: number, showError = false) {
    if (!spotifyTokens?.accessToken || !isSpotifyTokenFresh(spotifyTokens)) return;
    if (selectedSpotifyDevice && !selectedSpotifyDevice.supports_volume) return;

    try {
      await setSpotifyVolume(spotifyTokens.accessToken, musicVolume * nextGlobalVolume, selectedSpotifyDeviceId || undefined);
    } catch (error) {
      if (showError) {
        Alert.alert(
          "Volume Spotify non appliqué",
          "Spotify refuse parfois le volume si aucun appareil Premium actif n'est sélectionné. Rafraîchis les appareils Spotify puis sélectionne la cible."
        );
      }
    }
  }

  async function refreshSpotifyDevices(tokens = spotifyTokens) {
    if (!tokens?.accessToken || !isSpotifyTokenFresh(tokens)) return;

    setSpotifyDevicesLoading(true);
    try {
      const devices = await getSpotifyDevices(tokens.accessToken);
      setSpotifyDevices(devices);
      const activeDevice = devices.find((device) => device.is_active && device.id);
      const stillAvailable = devices.some((device) => device.id === selectedSpotifyDeviceId);
      const nextDeviceId = stillAvailable ? selectedSpotifyDeviceId : activeDevice?.id ?? devices[0]?.id ?? "";
      setSelectedSpotifyDeviceId(nextDeviceId);
      if (nextDeviceId) await storageService.saveSpotifyDeviceId(nextDeviceId);
    } catch (error) {
      Alert.alert("Appareils Spotify indisponibles", error instanceof Error ? error.message : "Impossible de récupérer les appareils.");
    } finally {
      setSpotifyDevicesLoading(false);
    }
  }

  async function selectSpotifyDevice(deviceId: string) {
    setSelectedSpotifyDeviceId(deviceId);
    await storageService.saveSpotifyDeviceId(deviceId);

    if (spotifyTokens?.accessToken && isSpotifyTokenFresh(spotifyTokens)) {
      try {
        await transferSpotifyPlayback(spotifyTokens.accessToken, deviceId, false);
      } catch {
        // Transfer can fail when Spotify marks the target device as temporarily unavailable.
      }
    }
  }

  async function ensureSelectedSpotifyDevice() {
    if (!spotifyTokens?.accessToken || !isSpotifyTokenFresh(spotifyTokens) || !selectedSpotifyDeviceId) return;
    await transferSpotifyPlayback(spotifyTokens.accessToken, selectedSpotifyDeviceId, false);
  }

  async function saveSpotifyClientId() {
    const cleanClientId = spotifyClientId.trim();
    if (!cleanClientId) {
      Alert.alert("Client ID requis", "Crée une application Spotify puis colle son Client ID ici.");
      return;
    }

    if (!SPOTIFY_CLIENT_ID) {
      await storageService.saveSpotifyClientId(cleanClientId);
    }
    Alert.alert("Spotify configuré", `Ajoute cette Redirect URI dans Spotify Developer Dashboard :\n${spotifyRedirectUri}`);
  }

  async function connectSpotify() {
    if (!spotifyClientId.trim()) {
      Alert.alert("Configuration requise", "Le développeur doit renseigner le Client ID Spotify dans src/config/spotify.ts.");
      setSpotifyConfigOpen(true);
      return;
    }

    if (!SPOTIFY_CLIENT_ID) {
      await storageService.saveSpotifyClientId(spotifyClientId.trim());
    }
    await promptSpotifyAsync();
  }

  async function disconnectSpotify() {
    setSpotifyTokens(null);
    setSpotifyProfileName("");
    await storageService.saveSpotifyTokens(null);
  }

  async function toggleFavoriteCategory(categoryId: string) {
    const nextFavorites = favoriteCategories.includes(categoryId)
      ? favoriteCategories.filter((id) => id !== categoryId)
      : [...favoriteCategories, categoryId];
    setFavoriteCategories(nextFavorites);
    await storageService.saveFavoriteCategories(nextFavorites);
  }

  async function createScene() {
    const selectedSounds = activeLoopIds
      .map((id) => sounds.find((sound) => sound.id === id))
      .filter((sound): sound is SoundAsset => Boolean(sound));

    if (!sceneName.trim()) {
      Alert.alert("Nom requis", "Donne un nom à la scène avant de la sauvegarder.");
      return;
    }

    if (selectedSounds.length === 0 && !sceneLink.trim()) {
      Alert.alert("Scène vide", "Lance au moins une ambiance ou ajoute un lien externe.");
      return;
    }

    const cleanLink = sceneLink.trim();
    const scene: Scene = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: sceneName.trim(),
      description: sceneDescription.trim() || undefined,
      sounds: selectedSounds.map((sound) => ({
        soundId: sound.id,
        track: sound.track,
        volume: 1
      })),
      favorite: false,
      externalLink: cleanLink || undefined,
      externalProvider: cleanLink ? detectExternalProvider(cleanLink) : undefined,
      transitionMinutes: Number(transitionMinutes) > 0 ? Number(transitionMinutes) : undefined,
      createdAt: new Date().toISOString()
    };

    await persistScenes([scene, ...scenes]);
    setSceneName("");
    setSceneDescription("");
    setSceneLink("");
    setTransitionMinutes("");
    setSceneModalVisible(false);
  }

  async function playScene(scene: Scene) {
    await audioService.stopAllLoops();
    const playableSounds = scene.sounds.reduce<Array<{ entry: SceneSound; sound: SoundAsset }>>((acc, entry) => {
      const sound = sounds.find((item) => item.id === entry.soundId);
      if (sound) acc.push({ entry, sound });
      return acc;
    }, []);

    for (const item of playableSounds) {
      await audioService.playLoop(item.sound, item.entry.volume);
    }

    setActiveLoopIds(playableSounds.map((item) => item.sound.id));

    if (scene.externalLink) {
      await playExternalAudioLink({
        id: scene.id,
        title: scene.name,
        url: scene.externalLink,
        provider: scene.externalProvider ?? detectExternalProvider(scene.externalLink),
        createdAt: scene.createdAt
      });
    }
  }

  async function toggleFavoriteScene(sceneId: string) {
    const nextScenes = scenes.map((scene) => (scene.id === sceneId ? { ...scene, favorite: !scene.favorite } : scene));
    await persistScenes(nextScenes);
  }

  function scheduleScene(scene: Scene) {
    if (!scene.transitionMinutes) return;
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(() => {
      playScene(scene);
    }, scene.transitionMinutes * 60 * 1000);
    Alert.alert("Transition programmée", `${scene.name} sera lancée dans ${scene.transitionMinutes} min.`);
  }

  async function stopAll() {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    await audioService.stopAllLoops();
    setActiveLoopIds([]);

    if (spotifyTokens?.accessToken && isSpotifyTokenFresh(spotifyTokens)) {
      try {
        await pauseSpotifyPlayback(spotifyTokens.accessToken, selectedSpotifyDeviceId || undefined);
      } catch {
        Alert.alert(
          "Spotify non arrêté",
          "Spotify n'a pas accepté la commande pause. Vérifie qu'un appareil Spotify actif est sélectionné."
        );
      }
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Table sonore du maître de jeu</Text>
          <Text style={styles.title}>JDR Ambiances</Text>
          <View style={styles.heroActions}>
            <AppButton icon="save" label="Créer une scène" tone="primary" onPress={() => setSceneModalVisible(true)} style={styles.heroButton} />
            <AppButton icon="stop" label="Tout arrêter" tone="danger" onPress={stopAll} style={styles.heroButton} />
          </View>
        </View>

        <Section title="Lecteur">
          <View style={styles.panel}>
            <VolumeStepper label="Volume global" value={globalVolume} onChange={updateGlobalVolume} />
            <Text style={styles.spotifyHint}>
              Le volume global agit sur les sons locaux et sur Spotify si un appareil Spotify actif est sélectionné.
            </Text>
          </View>
        </Section>

        <Section title="Spotify">
          <View style={styles.panel}>
            <View style={styles.spotifyHeader}>
              <View style={styles.spotifyCopy}>
                <Text style={styles.spotifyTitle}>{spotifyTokens ? "Compte connecté" : "Compte non connecté"}</Text>
                <Text style={styles.spotifyHint}>
                  {spotifyTokens
                    ? spotifyProfileName || "Spotify est prêt pour les liens et la piste Musique."
                    : SPOTIFY_CLIENT_ID
                      ? "Connecte Spotify pour lancer les playlists et piloter leur volume depuis le mixeur."
                      : "Client ID Spotify manquant dans la configuration développeur."}
                </Text>
              </View>
              {spotifyTokens ? (
                <AppButton compact icon="sign-out-alt" label="Déconnecter" tone="danger" onPress={disconnectSpotify} />
              ) : (
                <AppButton compact icon="spotify" label="Connecter" tone="primary" disabled={!spotifyClientId.trim() || !spotifyRequest} onPress={connectSpotify} />
              )}
            </View>
            {SPOTIFY_CLIENT_ID ? null : (
              <AppButton
                compact
                icon={spotifyConfigOpen ? "chevron-up" : "cog"}
                label={spotifyConfigOpen ? "Masquer la config" : "Configurer"}
                onPress={() => setSpotifyConfigOpen((open) => !open)}
              />
            )}
            {!SPOTIFY_CLIENT_ID && spotifyConfigOpen ? (
              <View style={styles.spotifyConfig}>
                <TextInput
                  value={spotifyClientId}
                  onChangeText={setSpotifyClientId}
                  placeholder="Spotify Client ID"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  style={styles.input}
                />
                <Text selectable style={styles.redirectUri}>
                  {spotifyRedirectUri}
                </Text>
                <View style={styles.modalActions}>
                  <AppButton label="Sauvegarder" icon="save" onPress={saveSpotifyClientId} style={styles.modalButton} />
                  <AppButton label="Connecter" icon="spotify" tone="primary" disabled={!spotifyClientId.trim() || !spotifyRequest} onPress={connectSpotify} style={styles.modalButton} />
                </View>
              </View>
            ) : null}
            {spotifyTokens ? (
              <View style={styles.spotifyDevices}>
                <View style={styles.spotifyDeviceHeader}>
                  <Text style={styles.spotifyDeviceTitle}>Appareil de lecture</Text>
                  <AppButton
                    compact
                    icon="sync-alt"
                    label={spotifyDevicesLoading ? "..." : "Rafraîchir"}
                    disabled={spotifyDevicesLoading}
                    onPress={() => refreshSpotifyDevices()}
                  />
                </View>
                {spotifyDevices.length === 0 ? (
                  <Text style={styles.spotifyHint}>
                    Aucun appareil Spotify détecté. Lance Spotify sur ton téléphone, ordinateur ou enceinte connectée, puis rafraîchis.
                  </Text>
                ) : (
                  <View style={styles.deviceList}>
                    {selectedSpotifyDevice && !selectedSpotifyDevice.supports_volume ? (
                      <Text style={styles.spotifyWarning}>
                        Cet appareil Spotify ne permet pas le contrôle du volume via l'API. Le bouton Tout arrêter reste disponible.
                      </Text>
                    ) : null}
                    {spotifyDevices.map((device) => {
                      const selected = device.id === selectedSpotifyDeviceId;
                      return (
                        <Pressable
                          key={device.id ?? device.name}
                          accessibilityRole="button"
                          onPress={() => device.id && selectSpotifyDevice(device.id)}
                          style={[styles.deviceButton, selected && styles.deviceButtonSelected]}
                        >
                          <Text numberOfLines={1} style={[styles.deviceName, selected && styles.deviceNameSelected]}>
                            {device.name}
                          </Text>
                          <Text numberOfLines={1} style={styles.deviceMeta}>
                            {device.type}
                            {device.is_active ? " · actif" : ""}
                            {device.supports_volume ? "" : " · volume non supporté"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : null}
          </View>
        </Section>

        {(favoriteCategories.length > 0 || favoriteScenes.length > 0) && (
          <Section title="Favoris">
            <View style={styles.favoriteRail}>
              {favoriteCategories.map((id) => {
                const category = ambientCategories.find((item) => item.id === id);
                if (!category) return null;
                const externalLink = categoryExternalLinks[id];
                return (
                  <AppButton
                    key={id}
                    compact
                    icon={category.icon}
                    label={category.title}
                    disabled={!categorySounds[id] && !externalLink}
                    onPress={() => toggleCategoryPlayback(id)}
                  />
                );
              })}
              {favoriteScenes.map((scene) => (
                <AppButton key={scene.id} compact icon="bookmark" label={scene.name} onPress={() => playScene(scene)} />
              ))}
            </View>
          </Section>
        )}

        <Section title="Ambiances">
          <View style={styles.categoryGrid}>
            {ambientCategories.map((category) => {
              const sound = categorySounds[category.id];
              const externalLink = categoryExternalLinks[category.id];
              return (
                <CategoryCard
                  key={category.id}
                  category={category}
                  hasAudio={Boolean(sound)}
                  externalLabel={externalLink ? externalButtonLabel(externalLink.provider) : undefined}
                  isPlaying={Boolean(sound && activeLoopIds.includes(sound.id))}
                  favorite={favoriteCategories.includes(category.id)}
                  onTogglePlay={() => toggleCategoryPlayback(category.id)}
                  onImport={() => importForCategory(category.id)}
                  onAttachExternalLink={() => openExternalLinkModal({ type: "category", id: category.id, title: category.title })}
                  onToggleFavorite={() => toggleFavoriteCategory(category.id)}
                />
              );
            })}
          </View>
        </Section>

        <Section title="Table de mixage">
          <View style={styles.panel}>
            {trackOrder.map((track) => (
              <VolumeStepper key={track} label={trackLabels[track]} value={mixer[track]} onChange={(value) => updateMixer(track, value)} />
            ))}
          </View>
        </Section>

        <Section title="Sons rapides">
          <View style={styles.quickGrid}>
            {quickEffects.map((effect) => (
              <QuickSoundPad
                key={effect.id}
                effect={effect}
                hasAudio={Boolean(quickSounds[effect.id])}
                externalLabel={quickExternalLinks[effect.id] ? externalButtonLabel(quickExternalLinks[effect.id]?.provider) : undefined}
                onPlay={() => playQuickEffect(effect.id)}
                onImport={() => importForQuickEffect(effect.id)}
                onAttachExternalLink={() => openExternalLinkModal({ type: "quick", id: effect.id, title: effect.title })}
              />
            ))}
          </View>
        </Section>

        <Section title="Scènes">
          <View style={styles.sceneList}>
            {scenes.length === 0 ? <Text style={styles.empty}>Aucune scène sauvegardée.</Text> : null}
            {scenes.map((scene) => (
              <View key={scene.id} style={styles.sceneCard}>
                <View style={styles.sceneHeader}>
                  <View style={styles.sceneCopy}>
                    <Text style={styles.sceneTitle}>{scene.name}</Text>
                    {scene.description ? <Text style={styles.sceneDescription}>{scene.description}</Text> : null}
                    <Text style={styles.sceneMeta}>
                      {scene.sounds.length} son(s){scene.transitionMinutes ? ` · transition ${scene.transitionMinutes} min` : ""}
                    </Text>
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => toggleFavoriteScene(scene.id)} style={styles.starButton}>
                    <Text style={[styles.starText, scene.favorite && styles.starActive]}>★</Text>
                  </Pressable>
                </View>
                <View style={styles.sceneActions}>
                  <AppButton compact icon="play" label="Lancer" tone="primary" onPress={() => playScene(scene)} style={styles.sceneButton} />
                  {scene.transitionMinutes ? (
                    <AppButton compact icon="clock" label="Programmer" onPress={() => scheduleScene(scene)} style={styles.sceneButton} />
                  ) : null}
                  {scene.externalLink ? (
                    <AppButton
                      compact
                      icon="external-link-alt"
                      label={externalButtonLabel(scene.externalProvider)}
                      onPress={() =>
                        playExternalAudioLink({
                          id: scene.id,
                          title: scene.name,
                          url: scene.externalLink ?? "",
                          provider: scene.externalProvider ?? detectExternalProvider(scene.externalLink ?? ""),
                          createdAt: scene.createdAt
                        })
                      }
                      style={styles.sceneButton}
                    />
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </Section>
      </ScrollView>

      <Modal visible={sceneModalVisible} animationType="slide" transparent onRequestClose={() => setSceneModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nouvelle scène</Text>
            <TextInput
              value={sceneName}
              onChangeText={setSceneName}
              placeholder="Combat dans une forêt sous la pluie"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <TextInput
              value={sceneDescription}
              onChangeText={setSceneDescription}
              placeholder="Notes rapides"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.textArea]}
              multiline
            />
            <TextInput
              value={sceneLink}
              onChangeText={setSceneLink}
              placeholder="Lien externe Spotify ou YouTube"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              value={transitionMinutes}
              onChangeText={setTransitionMinutes}
              placeholder="Transition après X minutes"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={styles.input}
            />
            <Text style={styles.modalHint}>La scène reprend les ambiances actuellement lancées.</Text>
            <View style={styles.modalActions}>
              <AppButton label="Annuler" onPress={() => setSceneModalVisible(false)} style={styles.modalButton} />
              <AppButton label="Sauvegarder" icon="save" tone="primary" onPress={createScene} style={styles.modalButton} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={linkModalVisible} animationType="slide" transparent onRequestClose={() => setLinkModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Lien externe</Text>
            <Text style={styles.modalHint}>{linkTarget?.title}</Text>
            <TextInput
              value={externalUrl}
              onChangeText={setExternalUrl}
              placeholder="https://open.spotify.com/... ou https://youtube.com/..."
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="url"
              style={styles.input}
            />
            <Text style={styles.modalHint}>
              Les liens Spotify et YouTube s'ouvrent dans leur application. Ils ne sont pas mixables par le volume interne.
            </Text>
            <View style={styles.modalActions}>
              <AppButton label="Annuler" onPress={() => setLinkModalVisible(false)} style={styles.modalButton} />
              <AppButton label="Sauvegarder" icon="link" tone="primary" onPress={saveExternalLink} style={styles.modalButton} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: 18,
    paddingBottom: 48
  },
  hero: {
    paddingTop: 16,
    paddingBottom: 8
  },
  kicker: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0
  },
  title: {
    marginTop: 6,
    color: colors.text,
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 0
  },
  heroActions: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10
  },
  heroButton: {
    flex: 1
  },
  panel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  spotifyHeader: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8
  },
  spotifyCopy: {
    flex: 1
  },
  spotifyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0
  },
  spotifyHint: {
    marginTop: 4,
    color: colors.muted,
    lineHeight: 18
  },
  spotifyWarning: {
    color: colors.gold,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  spotifyConfig: {
    gap: 10,
    paddingBottom: 10
  },
  spotifyDevices: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10
  },
  spotifyDeviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  spotifyDeviceTitle: {
    color: colors.text,
    fontWeight: "900",
    letterSpacing: 0
  },
  deviceList: {
    gap: 8
  },
  deviceButton: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: "center"
  },
  deviceButtonSelected: {
    borderColor: colors.gold,
    backgroundColor: "#2b2419"
  },
  deviceName: {
    color: colors.text,
    fontWeight: "800",
    letterSpacing: 0
  },
  deviceNameSelected: {
    color: colors.gold
  },
  deviceMeta: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12
  },
  redirectUri: {
    color: colors.gold,
    fontSize: 12,
    lineHeight: 17
  },
  favoriteRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4
  },
  sceneList: {
    gap: 12
  },
  empty: {
    color: colors.muted,
    fontWeight: "600"
  },
  sceneCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12
  },
  sceneHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  sceneCopy: {
    flex: 1
  },
  sceneTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0
  },
  sceneDescription: {
    marginTop: 4,
    color: colors.muted,
    lineHeight: 18
  },
  sceneMeta: {
    marginTop: 8,
    color: colors.gold,
    fontSize: 12,
    fontWeight: "800"
  },
  starButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center"
  },
  starText: {
    color: colors.muted,
    fontSize: 20
  },
  starActive: {
    color: colors.gold
  },
  sceneActions: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  sceneButton: {
    flexGrow: 1
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.62)"
  },
  modalCard: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 12,
    borderTopWidth: 1,
    borderColor: colors.border
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: 12,
    fontWeight: "700"
  },
  textArea: {
    minHeight: 84,
    paddingTop: 12,
    textAlignVertical: "top"
  },
  modalHint: {
    color: colors.muted,
    lineHeight: 18
  },
  modalActions: {
    flexDirection: "row",
    gap: 10
  },
  modalButton: {
    flex: 1
  }
});
