import React, { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesome5 } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import {
  Alert,
  BackHandler,
  Image,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { ambientCategories, quickEffects } from "../data/categories";
import { bundledQuickAudio } from "../data/bundledAudio";
import { AppButton } from "../components/AppButton";
import { CategoryCard } from "../components/CategoryCard";
import { QuickSoundPad } from "../components/QuickSoundPad";
import { Section } from "../components/Section";
import { SessionScreen } from "./SessionScreen";
import { SPOTIFY_CLIENT_ID } from "../config/spotify";
import { audioService } from "../services/audioService";
import { authService } from "../services/authService";
import { importAudioFile, importCampaignImageFile, pickAudioFile, PickedAudioFile, savePickedAudioFile } from "../services/importService";
import { paymentService } from "../services/paymentService";
import {
  getSpotifyDevices,
  forceStopSpotifyPlayback,
  getSpotifyProfile,
  isSpotifyTokenFresh,
  spotifyUriFromUrl,
  startSpotifyPlayback,
  transferSpotifyPlayback
} from "../services/spotifyService";
import { storageService } from "../services/storageService";
import { createSyncSnapshot, readLocalSyncSnapshot, saveLocalSyncSnapshot, syncService, SyncSnapshot } from "../services/syncService";
import { canUseFolders } from "../services/subscriptionService";
import { colors } from "../theme/colors";
import {
  CustomSound,
  CustomSoundKind,
  CampaignImage,
  ExternalAudioLink,
  LocalUser,
  Scene,
  SceneSound,
  SoundAsset,
  SoundFolder,
  SpotifyDevice,
  SpotifyTokens,
  SubscriptionTier,
  TrackType
} from "../types/audio";
import { detectExternalProvider, externalButtonLabel, openExternalLink, youtubeVideoIdFromUrl } from "../utils/links";

WebBrowser.maybeCompleteAuthSession();

const spotifyDiscovery = {
  authorizationEndpoint: "https://accounts.spotify.com/authorize",
  tokenEndpoint: "https://accounts.spotify.com/api/token"
};
const spotifyScopes = ["user-read-private", "user-read-playback-state", "user-modify-playback-state"];
// En développement avec Expo Go, utiliser le format exp://. Pour les builds natives, utiliser jdrambiances://
const spotifyRedirectUri = Linking.createURL("spotify-auth");
const iconChoices = [
  "hat-wizard",
  "dragon",
  "dungeon",
  "cloud-rain",
  "bolt",
  "fire",
  "skull",
  "music",
  "beer",
  "tree",
  "anchor",
  "moon",
  "door-open",
  "khanda",
  "magic",
  "crosshairs"
];
const accentChoices = [colors.gold, colors.red, "#4fa36b", "#4f8fa3", "#8d6bd1", "#d18a4f"];
type CustomSoundSource = "mobile" | "external";
type ExternalSoundKind = "youtube" | "other";

function latestItem<T>(items: T[]) {
  return items.length > 0 ? items[items.length - 1] : undefined;
}

function youtubePlayerHtml(videoId: string) {
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&enablejsapi=1&rel=0&modestbranding=1&origin=https%3A%2F%2Fjdrambiances.local`;
  return `
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body, iframe { margin: 0; width: 100%; height: 100%; background: #050406; overflow: hidden; border: 0; }
    </style>
  </head>
  <body>
    <iframe
      id="player"
      src="${embedUrl}"
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
    ></iframe>
    <script>
      function stopPlayer() {
        var player = document.getElementById('player');
        if (!player || !player.contentWindow) return;
        player.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'stopVideo', args: [] }), '*');
      }
    </script>
  </body>
</html>`;
}

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [sounds, setSounds] = useState<SoundAsset[]>([]);
  const [soundFolders, setSoundFolders] = useState<SoundFolder[]>([]);
  const [customSounds, setCustomSounds] = useState<CustomSound[]>([]);
  const [campaignImages, setCampaignImages] = useState<CampaignImage[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [folderDetailVisible, setFolderDetailVisible] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>("free");
  const [premiumSince, setPremiumSince] = useState<string | null>(null);
  const [localUser, setLocalUser] = useState<LocalUser | null>(null);
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [paywallModalVisible, setPaywallModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [pendingPremiumActivation, setPendingPremiumActivation] = useState(false);
  const [pendingPremiumFolderOpen, setPendingPremiumFolderOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [externalLinks, setExternalLinks] = useState<ExternalAudioLink[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [favoriteCategoriesByFolder, setFavoriteCategoriesByFolder] = useState<Record<string, string[]>>({});
  const [activeLoopIds, setActiveLoopIds] = useState<string[]>([]);
  const [spotifyClientId, setSpotifyClientId] = useState(SPOTIFY_CLIENT_ID);
  const [spotifyTokens, setSpotifyTokens] = useState<SpotifyTokens | null>(null);
  const [spotifyProfileName, setSpotifyProfileName] = useState("");
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
  const [externalLinkKind, setExternalLinkKind] = useState<ExternalSoundKind>("youtube");
  const [externalUrl, setExternalUrl] = useState("");
  const [sourceChoiceTarget, setSourceChoiceTarget] = useState<{ categoryId: string; title: string } | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderIcon, setFolderIcon] = useState("hat-wizard");
  const [sessionMode, setSessionMode] = useState(false);
  const [dmLocked, setDmLocked] = useState(false);
  const [quickColumns, setQuickColumns] = useState(4);
  const [customSoundModalVisible, setCustomSoundModalVisible] = useState(false);
  const [editingCustomSoundId, setEditingCustomSoundId] = useState<string | null>(null);
  const [customSoundKind, setCustomSoundKind] = useState<CustomSoundKind>("ambient");
  const [customSoundName, setCustomSoundName] = useState("");
  const [customSoundIcon, setCustomSoundIcon] = useState("music");
  const [customSoundAccent, setCustomSoundAccent] = useState(colors.gold);
  const [customSoundSection, setCustomSoundSection] = useState("");
  const [customSoundSource, setCustomSoundSource] = useState<CustomSoundSource>("mobile");
  const [customSoundExternalKind, setCustomSoundExternalKind] = useState<ExternalSoundKind>("youtube");
  const [customSoundExternalUrl, setCustomSoundExternalUrl] = useState("");
  const [customSoundPickedFile, setCustomSoundPickedFile] = useState<PickedAudioFile | null>(null);
  const [youtubePlayer, setYoutubePlayer] = useState<{ url: string; title: string } | null>(null);
  const [ambientDetail, setAmbientDetail] = useState<{ title: string; description: string; icon: string; accent: string } | null>(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [imageName, setImageName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [renamingImage, setRenamingImage] = useState<CampaignImage | null>(null);
  const [imageRenameName, setImageRenameName] = useState("");
  const [previewImage, setPreviewImage] = useState<CampaignImage | null>(null);
  const [imageFolderOpen, setImageFolderOpen] = useState(false);
  const [imageSearch, setImageSearch] = useState("");
  const modalSafeAreaStyle = { paddingBottom: 18 + insets.bottom };
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const youtubeWebViewRef = useRef<WebView>(null);
  const localUserRef = useRef<LocalUser | null>(null);
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
    localUserRef.current = localUser;
  }, [localUser]);

  useEffect(() => {
    async function bootstrap() {
      const [
        storedSounds,
        storedSoundFolders,
        storedCustomSounds,
        storedCampaignImages,
        storedExternalLinks,
        storedScenes,
        storedFavoriteCategoriesByFolder,
        storedSpotifyClientId,
        storedSpotifyTokens,
        storedSpotifyDeviceId,
        storedSubscriptionTier,
        storedPremiumSince,
        storedLocalUser,
        restoredApiUser
      ] = await Promise.all([
        storageService.getSounds(),
        storageService.getSoundFolders(),
        storageService.getCustomSounds(),
        storageService.getCampaignImages(),
        storageService.getExternalAudioLinks(),
        storageService.getScenes(),
        storageService.getFavoriteCategoriesByFolder(),
        storageService.getSpotifyClientId(),
        storageService.getSpotifyTokens(),
        storageService.getSpotifyDeviceId(),
        storageService.getSubscriptionTier(),
        storageService.getPremiumSince(),
        storageService.getLocalUser(),
        authService.restoreSession()
      ]);
      const currentUser = restoredApiUser ?? storedLocalUser;
      setSounds(currentUser ? storedSounds : []);
      setSoundFolders(currentUser ? storedSoundFolders : []);
      setCustomSounds(currentUser ? storedCustomSounds : []);
      setCampaignImages(currentUser ? storedCampaignImages : []);
      setSelectedFolderId(currentUser ? storedSoundFolders[0]?.id ?? "" : "");
      setExternalLinks(currentUser ? storedExternalLinks : []);
      setScenes(currentUser ? storedScenes : []);
      setFavoriteCategoriesByFolder(currentUser ? storedFavoriteCategoriesByFolder : {});
      setSpotifyClientId(SPOTIFY_CLIENT_ID || storedSpotifyClientId);
      setSpotifyTokens(storedSpotifyTokens);
      setSelectedSpotifyDeviceId(storedSpotifyDeviceId);
      const restoredTier = currentUser ? storedSubscriptionTier : "free";
      setSubscriptionTier(restoredTier);
      setPremiumSince(restoredTier === "premium" ? storedPremiumSince : null);
      setLocalUser(currentUser);
      if (!currentUser && storedSubscriptionTier === "premium") {
        await storageService.saveSubscriptionTier("free");
        await storageService.savePremiumSince(null);
      }
      if (!currentUser) {
        await storageService.clearUserData();
      }
      if (currentUser) {
        try {
          const remote = await syncService.pull();
          if (remote.data) {
            await applyRemoteSnapshot(remote.data);
          } else {
            await syncService.push(createSyncSnapshot({
              sounds: storedSounds,
              soundFolders: storedSoundFolders,
              customSounds: storedCustomSounds,
              campaignImages: storedCampaignImages,
              externalLinks: storedExternalLinks,
              scenes: storedScenes,
              favoriteCategoriesByFolder: storedFavoriteCategoriesByFolder
            }));
          }
        } catch {
          // L'app reste utilisable hors ligne; la prochaine sauvegarde retentera la synchro.
        }
      }
      await audioService.configure();
    }

    bootstrap();

    return () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      if (syncTimer.current) clearTimeout(syncTimer.current);
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

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (folderDetailVisible) {
        setFolderDetailVisible(false);
        return true;
      }

      return false;
    });

    return () => subscription.remove();
  }, [folderDetailVisible]);

  const categorySounds = useMemo(() => {
    return ambientCategories.reduce<Record<string, SoundAsset | undefined>>((acc, category) => {
      acc[category.id] = latestItem(sounds.filter((sound) => sound.categoryId === category.id));
      return acc;
    }, {});
  }, [sounds]);

  const quickSounds = useMemo(() => {
    return quickEffects.reduce<Record<string, SoundAsset | undefined>>((acc, effect) => {
      const importedSound = latestItem(sounds.filter((sound) => sound.quickEffectId === effect.id));
      acc[effect.id] =
        importedSound ??
        (effect.bundledAudioKey && bundledQuickAudio[effect.bundledAudioKey]
          ? {
              id: `bundled-quick-${effect.id}`,
              title: effect.title,
              bundledAudioKey: effect.bundledAudioKey,
              quickEffectId: effect.id,
              track: "sfx",
              createdAt: "bundled"
            }
          : undefined);
      return acc;
    }, {});
  }, [sounds]);
  const playableQuickEffects = useMemo(() => quickEffects.filter((effect) => quickSounds[effect.id]), [quickSounds]);

  const categoryExternalLinks = useMemo(() => {
    return ambientCategories.reduce<Record<string, ExternalAudioLink | undefined>>((acc, category) => {
      acc[category.id] = latestItem(externalLinks.filter((link) => link.categoryId === category.id));
      return acc;
    }, {});
  }, [externalLinks]);

  const selectedFolder = soundFolders.find((folder) => folder.id === selectedFolderId);
  const selectedFolderSounds = customSounds
    .filter((sound) => sound.folderId === selectedFolderId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const selectedFolderAmbiences = selectedFolderSounds.filter((sound) => sound.kind === "ambient");
  const selectedFolderQuickSounds = selectedFolderSounds.filter((sound) => sound.kind === "quick");
  const selectedFolderScenes = scenes.filter((scene) => scene.folderId === selectedFolderId);
  const selectedFolderImages = campaignImages.filter((image) => image.folderId === selectedFolderId);
  const visibleFolderImages = selectedFolderImages.filter((image) => {
    const query = imageSearch.trim().toLowerCase();
    if (!query) return true;

    return `${image.title} ${image.fileName ?? ""}`.toLowerCase().includes(query);
  });
  const visibleFolderSounds = selectedFolderSounds;
  const visibleFolderAmbiences = visibleFolderSounds.filter((sound) => sound.kind === "ambient");
  const visibleFolderQuickSounds = visibleFolderSounds.filter((sound) => sound.kind === "quick");
  const customSoundAssets = useMemo(() => {
    return customSounds.reduce<Record<string, SoundAsset | undefined>>((acc, customSound) => {
      acc[customSound.id] = latestItem(sounds.filter((sound) => sound.customSoundId === customSound.id));
      return acc;
    }, {});
  }, [customSounds, sounds]);

  const favoriteScenes = scenes.filter((scene) => scene.favorite);
  // Utiliser "global" comme clé pour les favoris en vue globale, le folderID en vue détaillée
  const favoritesFolderId = folderDetailVisible && selectedFolderId ? selectedFolderId : "global";
  const currentFavoriteCategoryIds = favoriteCategoriesByFolder[favoritesFolderId] || [];
  const isPremium = subscriptionTier === "premium";
  const isSignedIn = Boolean(localUser);
  const folderAccess = canUseFolders(localUser, subscriptionTier);

  function sceneEntryCount(scene: Scene) {
    return scene.sounds.length + (scene.externalLink ? 1 : 0);
  }

  function resetCustomSoundForm() {
    setEditingCustomSoundId(null);
    setCustomSoundName("");
    setCustomSoundIcon("music");
    setCustomSoundAccent(colors.gold);
    setCustomSoundSection("");
    setCustomSoundSource("mobile");
    setCustomSoundExternalKind("youtube");
    setCustomSoundExternalUrl("");
    setCustomSoundPickedFile(null);
  }

  async function persistSounds(nextSounds: SoundAsset[]) {
    setSounds(nextSounds);
    await storageService.saveSounds(nextSounds);
    scheduleSyncPush();
  }

  async function persistSoundFolders(nextFolders: SoundFolder[]) {
    setSoundFolders(nextFolders);
    await storageService.saveSoundFolders(nextFolders);
    scheduleSyncPush();
  }

  async function persistCustomSounds(nextCustomSounds: CustomSound[]) {
    setCustomSounds(nextCustomSounds);
    await storageService.saveCustomSounds(nextCustomSounds);
    scheduleSyncPush();
  }

  async function persistCampaignImages(nextImages: CampaignImage[]) {
    setCampaignImages(nextImages);
    await storageService.saveCampaignImages(nextImages);
    scheduleSyncPush();
  }

  async function persistExternalLinks(nextLinks: ExternalAudioLink[]) {
    setExternalLinks(nextLinks);
    await storageService.saveExternalAudioLinks(nextLinks);
    scheduleSyncPush();
  }

  async function persistScenes(nextScenes: Scene[]) {
    setScenes(nextScenes);
    await storageService.saveScenes(nextScenes);
    scheduleSyncPush();
  }

  function clearUserDataState() {
    setSounds([]);
    setSoundFolders([]);
    setCustomSounds([]);
    setCampaignImages([]);
    setExternalLinks([]);
    setScenes([]);
    setFavoriteCategoriesByFolder({});
    setSelectedFolderId("");
    setFolderDetailVisible(false);
    setSessionMode(false);
    setImageFolderOpen(false);
    setPreviewImage(null);
    setAmbientDetail(null);
    setYoutubePlayer(null);
  }

  function currentSyncSnapshot(overrides: Partial<SyncSnapshot> = {}) {
    return createSyncSnapshot({
      sounds: overrides.sounds ?? sounds,
      soundFolders: overrides.soundFolders ?? soundFolders,
      customSounds: overrides.customSounds ?? customSounds,
      campaignImages: overrides.campaignImages ?? campaignImages,
      externalLinks: overrides.externalLinks ?? externalLinks,
      scenes: overrides.scenes ?? scenes,
      favoriteCategoriesByFolder: overrides.favoriteCategoriesByFolder ?? favoriteCategoriesByFolder
    });
  }

  async function pushCurrentSync(overrides: Partial<SyncSnapshot> = {}) {
    if (!localUserRef.current) return;

    try {
      await syncService.push(currentSyncSnapshot(overrides));
    } catch {
      // La synchro ne doit pas bloquer l'utilisation locale de l'app.
    }
  }

  function scheduleSyncPush() {
    if (!localUserRef.current) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);

    syncTimer.current = setTimeout(() => {
      void (async () => {
        try {
          await syncService.push(await readLocalSyncSnapshot());
        } catch {
          // L'app reste locale si le reseau est indisponible.
        }
      })();
    }, 650);
  }

  async function applyRemoteSnapshot(snapshot: SyncSnapshot) {
    setSounds(snapshot.sounds ?? []);
    setSoundFolders(snapshot.soundFolders ?? []);
    setCustomSounds(snapshot.customSounds ?? []);
    setCampaignImages(snapshot.campaignImages ?? []);
    setExternalLinks(snapshot.externalLinks ?? []);
    setScenes(snapshot.scenes ?? []);
    setFavoriteCategoriesByFolder(snapshot.favoriteCategoriesByFolder ?? {});
    setSelectedFolderId(snapshot.soundFolders?.[0]?.id ?? "");
    await saveLocalSyncSnapshot(snapshot);
  }

  async function syncAfterLogin() {
    try {
      const remote = await syncService.pull();
      if (remote.data) {
        await applyRemoteSnapshot(remote.data);
        return;
      }

      await syncService.push(currentSyncSnapshot());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Les donnees n'ont pas pu etre synchronisees pour le moment.";
      Alert.alert("Synchronisation indisponible", message);
    }
  }

  function openFolderCreation() {
    if (!folderAccess) {
      setPaywallModalVisible(true);
      return;
    }

    setFolderModalVisible(true);
  }

  async function updateSubscriptionTier(nextTier: SubscriptionTier) {
    setSubscriptionTier(nextTier);
    await storageService.saveSubscriptionTier(nextTier);

    if (nextTier === "free") {
      setPremiumSince(null);
      await storageService.savePremiumSince(null);
    }
  }

  async function activatePremium(openFolderAfter = true) {
    if (!localUser) {
      setPendingPremiumActivation(true);
      setPendingPremiumFolderOpen(openFolderAfter);
      setPaywallModalVisible(false);
      setAccountModalVisible(false);
      setAuthMode("signup");
      setAuthModalVisible(true);
      return;
    }

    setPendingPremiumFolderOpen(openFolderAfter);
    setPaywallModalVisible(false);
    setAccountModalVisible(false);
    setPaymentModalVisible(true);
  }

  function openAuthModal(mode: "login" | "signup", premiumAfterAuth = false, openFolderAfter = false) {
    setAuthMode(mode);
    setPendingPremiumActivation(premiumAfterAuth);
    setPendingPremiumFolderOpen(openFolderAfter);
    setAccountModalVisible(false);
    setPaywallModalVisible(false);
    setAuthModalVisible(true);
  }

  async function submitAuth() {
    setAuthLoading(true);
    try {
      const user =
        authMode === "signup"
          ? await authService.signup(authEmail, authPassword)
          : await authService.login(authEmail, authPassword);

      setLocalUser(user);
      localUserRef.current = user;
      setAuthEmail("");
      setAuthPassword("");
      setAuthModalVisible(false);
      await syncAfterLogin();

      if (pendingPremiumActivation) {
        setPaymentModalVisible(true);
      }

      setPendingPremiumActivation(false);
    } catch (error) {
      Alert.alert("Connexion impossible", error instanceof Error ? error.message : "Reessaie dans un instant.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function confirmMockPayment() {
    if (!localUser) {
      setPaymentModalVisible(false);
      openAuthModal("signup", true, pendingPremiumFolderOpen);
      return;
    }

    setPaymentLoading(true);
    try {
      const activation = await paymentService.startPremiumCheckout(localUser, premiumSince);
      setSubscriptionTier(activation.tier);
      setPremiumSince(activation.premiumSince ?? null);
      await storageService.saveSubscriptionTier(activation.tier);
      await storageService.savePremiumSince(activation.premiumSince ?? null);
      setPaymentModalVisible(false);

      if (pendingPremiumFolderOpen) setFolderModalVisible(true);
      setPendingPremiumFolderOpen(false);
    } catch (error) {
      Alert.alert("Paiement impossible", error instanceof Error ? error.message : "Reessaie dans un instant.");
    } finally {
      setPaymentLoading(false);
    }
  }

  async function signOutLocalUser() {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    setLocalUser(null);
    localUserRef.current = null;
    await authService.signOut();
    await audioService.stopAllLoops();
    setActiveLoopIds([]);
    clearUserDataState();
    await storageService.clearUserData();
    await updateSubscriptionTier("free");
    setAccountModalVisible(false);
  }

  async function importForCategory(categoryId: string) {
    if (categorySounds[categoryId] || categoryExternalLinks[categoryId]) {
      Alert.alert("Ambiance deja associee", "Supprime le son ou le lien existant avant d'en ajouter un nouveau.");
      return;
    }

    const category = ambientCategories.find((item) => item.id === categoryId);
    const asset = await importAudioFile({
      title: `Ambiance - ${category?.title ?? "JDR"}`,
      track: "ambient",
      categoryId
    });
    if (asset) await persistSounds([...sounds, asset]);
  }

  function openCategorySourceChoice(categoryId: string, title: string) {
    if (categorySounds[categoryId] || categoryExternalLinks[categoryId]) {
      Alert.alert("Ambiance deja associee", "Supprime le son ou le lien existant avant d'en ajouter un nouveau.");
      return;
    }

    setSourceChoiceTarget({ categoryId, title });
  }

  async function chooseCategoryMobileSource() {
    if (!sourceChoiceTarget) return;
    const categoryId = sourceChoiceTarget.categoryId;
    setSourceChoiceTarget(null);
    await importForCategory(categoryId);
  }

  function chooseCategoryExternalSource() {
    if (!sourceChoiceTarget) return;
    const target = sourceChoiceTarget;
    setSourceChoiceTarget(null);
    openExternalLinkModal({ type: "category", id: target.categoryId, title: target.title });
  }

  function confirmDeleteCategorySound(categoryId: string) {
    const category = ambientCategories.find((item) => item.id === categoryId);
    Alert.alert("Supprimer le son", `Supprimer le son importe pour "${category?.title ?? "cette ambiance"}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          const assetIds = sounds.filter((sound) => sound.categoryId === categoryId).map((sound) => sound.id);
          await Promise.all(assetIds.map((id) => audioService.stopLoop(id)));
          setActiveLoopIds((ids) => ids.filter((id) => !assetIds.includes(id)));
          await persistSounds(sounds.filter((sound) => sound.categoryId !== categoryId));
        }
      }
    ]);
  }

  function confirmDeleteCategoryLink(categoryId: string) {
    const category = ambientCategories.find((item) => item.id === categoryId);
    Alert.alert("Supprimer le lien", `Supprimer le lien associe a "${category?.title ?? "cette ambiance"}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await persistExternalLinks(externalLinks.filter((link) => link.categoryId !== categoryId));
        }
      }
    ]);
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

  async function createSoundFolder() {
    if (!folderAccess) {
      setFolderModalVisible(false);
      setPaywallModalVisible(true);
      return;
    }

    const cleanName = folderName.trim();
    if (!cleanName) {
      Alert.alert("Nom requis", "Donne un nom a la campagne JDR.");
      return;
    }

    const folder: SoundFolder = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: cleanName,
      icon: folderIcon.trim() || "hat-wizard",
      accent: colors.gold,
      createdAt: new Date().toISOString()
    };

    const nextFolders = [...soundFolders, folder];
    await persistSoundFolders(nextFolders);
    
    // Initialiser les favoris pour ce nouveau dossier
    const nextFavoriteCategoriesByFolder = {
      ...favoriteCategoriesByFolder,
      [folder.id]: []
    };
    setFavoriteCategoriesByFolder(nextFavoriteCategoriesByFolder);
    await storageService.saveFavoriteCategoriesByFolder(nextFavoriteCategoriesByFolder);
    scheduleSyncPush();
    
    setSelectedFolderId(folder.id);
    setFolderDetailVisible(true);
    setFolderName("");
    setFolderIcon("hat-wizard");
    setFolderModalVisible(false);
  }

  function openCustomSoundModal(kind: CustomSoundKind) {
    if (!selectedFolderId) {
      Alert.alert("Campagne requise", "Cree ou selectionne une campagne JDR avant d'ajouter un son.");
      return;
    }

    setCustomSoundKind(kind);
    setEditingCustomSoundId(null);
    setCustomSoundName("");
    setCustomSoundIcon(kind === "ambient" ? "cloud-rain" : "bolt");
    setCustomSoundAccent(kind === "ambient" ? colors.gold : colors.red);
    setCustomSoundSection("");
    setCustomSoundSource("mobile");
    setCustomSoundExternalKind("youtube");
    setCustomSoundExternalUrl("");
    setCustomSoundPickedFile(null);
    setCustomSoundModalVisible(true);
  }

  async function chooseCustomSoundFile() {
    const picked = await pickAudioFile();
    if (picked) setCustomSoundPickedFile(picked);
  }

  async function addCampaignImageFromPhone() {
    if (!selectedFolderId) {
      Alert.alert("Campagne requise", "Ouvre une campagne avant d'ajouter une image.");
      return;
    }

    const image = await importCampaignImageFile(selectedFolderId);
    if (image) await persistCampaignImages([...campaignImages, image]);
  }

  function openImageLinkModal() {
    if (!selectedFolderId) {
      Alert.alert("Campagne requise", "Ouvre une campagne avant d'ajouter une image.");
      return;
    }

    setImageName("");
    setImageUrl("");
    setImageModalVisible(true);
  }

  async function saveCampaignImageLink() {
    if (!selectedFolderId) return;

    const cleanUrl = imageUrl.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      Alert.alert("Lien invalide", "Le lien doit commencer par http:// ou https://.");
      return;
    }

    const image: CampaignImage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      folderId: selectedFolderId,
      title: imageName.trim() || "Image externe",
      uri: cleanUrl,
      source: "link",
      createdAt: new Date().toISOString()
    };

    await persistCampaignImages([...campaignImages, image]);
    setImageName("");
    setImageUrl("");
    setImageModalVisible(false);
  }

  async function deleteCampaignImage(imageId: string) {
    await persistCampaignImages(campaignImages.filter((image) => image.id !== imageId));
  }

  function openRenameCampaignImage(image: CampaignImage) {
    setRenamingImage(image);
    setImageRenameName(image.title);
  }

  async function saveCampaignImageName() {
    if (!renamingImage) return;

    const cleanName = imageRenameName.trim();
    if (!cleanName) {
      Alert.alert("Nom requis", "Donne un nom a cette image.");
      return;
    }

    const nextImages = campaignImages.map((image) =>
      image.id === renamingImage.id ? { ...image, title: cleanName } : image
    );
    await persistCampaignImages(nextImages);
    setRenamingImage(null);
    setImageRenameName("");
  }

  function openEditCustomSoundModal(customSound: CustomSound) {
    setEditingCustomSoundId(customSound.id);
    setCustomSoundKind(customSound.kind);
    setCustomSoundName(customSound.title);
    setCustomSoundIcon(customSound.icon);
    setCustomSoundAccent(customSound.accent);
    setCustomSoundSection(customSound.section ?? "");
    setCustomSoundSource(customSound.externalLink ? "external" : "mobile");
    setCustomSoundExternalKind(customSound.externalProvider === "youtube" || customSound.externalProvider === "youtubeMusic" ? "youtube" : "other");
    setCustomSoundExternalUrl(customSound.externalLink ?? "");
    setCustomSoundPickedFile(null);
    setCustomSoundModalVisible(true);
  }

  function openAmbientDetail(params: { title: string; description?: string; icon: string; accent: string }) {
    setAmbientDetail({
      title: params.title,
      description: params.description?.trim() || "Aucune description.",
      icon: params.icon,
      accent: params.accent
    });
  }

  async function createCustomSound() {
    if (!selectedFolderId) return;
    const cleanName = customSoundName.trim();
    if (!cleanName) {
      Alert.alert("Nom requis", "Donne un nom au son.");
      return;
    }

    const cleanExternalUrl = customSoundKind === "ambient" && customSoundSource === "external" ? customSoundExternalUrl.trim() : "";
    if (customSoundKind === "quick" && cleanExternalUrl) {
      Alert.alert("Lien non disponible", "Les sons rapides doivent utiliser un fichier audio du telephone.");
      return;
    }

    if (cleanExternalUrl && !/^https?:\/\//i.test(cleanExternalUrl)) {
      Alert.alert("Lien invalide", "Le lien doit commencer par http:// ou https://.");
      return;
    }

    if (customSoundKind === "ambient" && customSoundSource === "external" && !cleanExternalUrl) {
      Alert.alert("Lien requis", "Ajoute un lien externe avant de valider.");
      return;
    }

    if (cleanExternalUrl && customSoundExternalKind === "youtube" && !youtubeVideoIdFromUrl(cleanExternalUrl)) {
      Alert.alert("Lien YouTube invalide", "Ajoute un lien YouTube ou YouTube Music contenant une video.");
      return;
    }

    if (cleanExternalUrl && customSoundExternalKind === "other") {
      const provider = detectExternalProvider(cleanExternalUrl);
      if (provider === "youtube" || provider === "youtubeMusic") {
        Alert.alert("Choisis YouTube", "Ce lien est un lien YouTube. Selectionne YouTube pour utiliser le lecteur integre.");
        return;
      }
    }

    if (!editingCustomSoundId && !cleanExternalUrl && !customSoundPickedFile) {
      Alert.alert("Fichier requis", "Choisis un fichier audio depuis le telephone avant de valider.");
      return;
    }

    if (editingCustomSoundId) {
      const nextTrack: TrackType = customSoundKind === "ambient" ? "ambient" : "sfx";
      const nextCustomSounds = customSounds.map((sound) =>
        sound.id === editingCustomSoundId
          ? {
              ...sound,
              title: cleanName,
              icon: customSoundIcon.trim() || sound.icon,
              accent: customSoundAccent,
              kind: customSoundKind,
              track: nextTrack,
              section: customSoundSection.trim() || undefined,
              externalLink: cleanExternalUrl || undefined,
              externalProvider: cleanExternalUrl ? detectExternalProvider(cleanExternalUrl) : undefined
            }
          : sound
      );
      await persistCustomSounds(nextCustomSounds);

      if (customSoundPickedFile) {
        const asset = await savePickedAudioFile(customSoundPickedFile, {
          title: cleanName,
          track: nextTrack,
          folderId: selectedFolderId,
          customSoundId: editingCustomSoundId
        });
        await persistSounds([...sounds, asset]);
      }

      resetCustomSoundForm();
      setCustomSoundModalVisible(false);
      return;
    }

    const customSound: CustomSound = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      folderId: selectedFolderId,
      title: cleanName,
      icon: customSoundIcon.trim() || (customSoundKind === "ambient" ? "music" : "bolt"),
      accent: customSoundAccent,
      kind: customSoundKind,
      track: customSoundKind === "ambient" ? "ambient" : "sfx",
      section: customSoundSection.trim() || undefined,
      externalLink: cleanExternalUrl || undefined,
      externalProvider: cleanExternalUrl ? detectExternalProvider(cleanExternalUrl) : undefined,
      sortOrder: customSounds.filter((sound) => sound.folderId === selectedFolderId).length,
      createdAt: new Date().toISOString()
    };

    if (cleanExternalUrl && !customSoundPickedFile) {
      await persistCustomSounds([...customSounds, customSound]);
      resetCustomSoundForm();
      setCustomSoundModalVisible(false);
      return;
    }

    if (!customSoundPickedFile) return;

    const asset = await savePickedAudioFile(customSoundPickedFile, {
      title: cleanName,
      track: customSound.track,
      folderId: selectedFolderId,
      customSoundId: customSound.id
    });

    await persistCustomSounds([...customSounds, customSound]);
    await persistSounds([...sounds, asset]);
    resetCustomSoundForm();
    setCustomSoundModalVisible(false);
  }

  function confirmDeleteCustomSound(customSound: CustomSound) {
    if (dmLocked) {
      Alert.alert("Mode verrouillé", "Déverrouille le mode MJ avant de modifier ou supprimer des sons.");
      return;
    }

    Alert.alert("Supprimer le son", `Supprimer "${customSound.title}" de la campagne ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          const assetIds = sounds.filter((sound) => sound.customSoundId === customSound.id).map((sound) => sound.id);
          await Promise.all(assetIds.map((id) => audioService.stopLoop(id)));
          setActiveLoopIds((ids) => ids.filter((id) => !assetIds.includes(id)));
          await persistSounds(sounds.filter((sound) => sound.customSoundId !== customSound.id));
          await persistCustomSounds(customSounds.filter((sound) => sound.id !== customSound.id));
        }
      }
    ]);
  }

  function confirmDeleteSelectedFolder() {
    if (!selectedFolder) return;
    if (dmLocked) {
      Alert.alert("Mode verrouille", "Deverrouille le mode MJ avant de supprimer une campagne.");
      return;
    }

    Alert.alert("Supprimer la campagne", `Supprimer la campagne "${selectedFolder.name}" et tous ses sons ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          const folderCustomSoundIds = customSounds.filter((sound) => sound.folderId === selectedFolder.id).map((sound) => sound.id);
          const folderAssetIds = sounds.filter((sound) => sound.folderId === selectedFolder.id || (sound.customSoundId && folderCustomSoundIds.includes(sound.customSoundId))).map((sound) => sound.id);
          await Promise.all(folderAssetIds.map((id) => audioService.stopLoop(id)));
          setActiveLoopIds((ids) => ids.filter((id) => !folderAssetIds.includes(id)));
          await persistSounds(sounds.filter((sound) => sound.folderId !== selectedFolder.id && (!sound.customSoundId || !folderCustomSoundIds.includes(sound.customSoundId))));
          await persistCustomSounds(customSounds.filter((sound) => sound.folderId !== selectedFolder.id));
          await persistCampaignImages(campaignImages.filter((image) => image.folderId !== selectedFolder.id));
          const nextFolders = soundFolders.filter((folder) => folder.id !== selectedFolder.id);
          await persistSoundFolders(nextFolders);
          
          // Supprimer les favoris du dossier
          const nextFavoriteCategoriesByFolder = { ...favoriteCategoriesByFolder };
          delete nextFavoriteCategoriesByFolder[selectedFolder.id];
          setFavoriteCategoriesByFolder(nextFavoriteCategoriesByFolder);
          await storageService.saveFavoriteCategoriesByFolder(nextFavoriteCategoriesByFolder);
          scheduleSyncPush();
          
          setSelectedFolderId(nextFolders[0]?.id ?? "");
          setFolderDetailVisible(false);
        }
      }
    ]);
  }

  async function moveCustomSound(customSoundId: string, direction: -1 | 1) {
    const folderSounds = selectedFolderSounds;
    const currentIndex = folderSounds.findIndex((sound) => sound.id === customSoundId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= folderSounds.length) return;

    const reordered = [...folderSounds];
    const [item] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, item);
    const orderById = new Map(reordered.map((sound, index) => [sound.id, index]));
    const nextCustomSounds = customSounds.map((sound) =>
      sound.folderId === selectedFolderId ? { ...sound, sortOrder: orderById.get(sound.id) ?? sound.sortOrder ?? 0 } : sound
    );
    await persistCustomSounds(nextCustomSounds);
  }


  async function toggleCustomAmbient(customSoundId: string) {
    const asset = customSoundAssets[customSoundId];
    const customSound = customSounds.find((sound) => sound.id === customSoundId);
    if (!asset) {
      if (customSound?.externalLink) {
        await playExternalAudioLink({
          id: customSound.id,
          title: customSound.title,
          url: customSound.externalLink,
          provider: customSound.externalProvider ?? detectExternalProvider(customSound.externalLink),
          createdAt: customSound.createdAt
        });
      }
      return;
    }

    if (activeLoopIds.includes(asset.id)) {
      await audioService.stopLoop(asset.id);
      setActiveLoopIds((ids) => ids.filter((id) => id !== asset.id));
    } else {
      await audioService.playLoop(asset, 1);
      setActiveLoopIds((ids) => [...ids, asset.id]);
    }
  }

  async function playCustomQuickSound(customSoundId: string) {
    const asset = customSoundAssets[customSoundId];
    const customSound = customSounds.find((sound) => sound.id === customSoundId);
    if (asset) {
      await audioService.playOneShot(asset, 1);
      return;
    }

    if (customSound?.externalLink) {
      await playExternalAudioLink({
        id: customSound.id,
        title: customSound.title,
        url: customSound.externalLink,
        provider: customSound.externalProvider ?? detectExternalProvider(customSound.externalLink),
        createdAt: customSound.createdAt
      });
    }
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
      const otherCategoryLoopIds = activeLoopIds.filter((id) => {
        const activeSound = sounds.find((item) => item.id === id);
        return Boolean(activeSound?.categoryId && activeSound.id !== sound.id);
      });
      await Promise.all(otherCategoryLoopIds.map((id) => audioService.stopLoop(id)));
      await audioService.playLoop(sound, 1);
      setActiveLoopIds((ids) => [...ids.filter((id) => !otherCategoryLoopIds.includes(id)), sound.id]);
    }
  }

  async function playQuickEffect(effectId: string) {
    const sound = quickSounds[effectId];
    if (sound) {
      await audioService.playOneShot(sound, 1);
    }
  }

  function openYoutubePlayer(url: string, title: string) {
    const videoId = youtubeVideoIdFromUrl(url);
    if (!videoId) {
      Alert.alert("Lien YouTube invalide", "Ce lien YouTube ne contient pas de video lisible.");
      return;
    }

    setYoutubePlayer({ url, title });
  }

  function stopYoutubePlayer() {
    youtubeWebViewRef.current?.injectJavaScript("if (typeof stopPlayer === 'function') { stopPlayer(); } true;");
    setYoutubePlayer(null);
  }

  async function playExternalAudioLink(link?: ExternalAudioLink) {
    if (!link?.url) return;

    if (link.provider === "youtube" || link.provider === "youtubeMusic") {
      openYoutubePlayer(link.url, link.title);
      return;
    }

    if (link.provider === "spotify") {
      if (!spotifyTokens?.accessToken || !isSpotifyTokenFresh(spotifyTokens)) {
        Alert.alert("Spotify requis", "Connecte Spotify dans l'app pour lancer ce lien sans quitter l'application.");
        return;
      }

      const spotifyUri = spotifyUriFromUrl(link.url);
      if (!spotifyUri) {
        Alert.alert("Lien Spotify invalide", "Ce lien Spotify n'est pas reconnu par l'application.");
        return;
      }

      try {
        await ensureSelectedSpotifyDevice();
        await startSpotifyPlayback(spotifyTokens.accessToken, spotifyUri, selectedSpotifyDeviceId || undefined);
      } catch {
        Alert.alert(
          "Lecture Spotify impossible",
          "Ouvre Spotify sur ton telephone, lance une lecture une fois, puis reessaie. Spotify Premium est requis pour le controle a distance."
        );
      }
      return;
    }

    await openExternalLink(link.url);
  }
  function openExternalLinkModal(target: { type: "category" | "quick"; id: string; title: string }) {
    if (target.type === "quick") {
      Alert.alert("Lien non disponible", "Les sons rapides utilisent uniquement des fichiers audio du telephone.");
      return;
    }

    if (target.type === "category" && (categorySounds[target.id] || categoryExternalLinks[target.id])) {
      Alert.alert("Ambiance deja associee", "Supprime le son ou le lien existant avant d'en ajouter un nouveau.");
      return;
    }

    const currentLink =
      target.type === "category"
        ? categoryExternalLinks[target.id]
        : undefined;
    setLinkTarget(target);
    setExternalLinkKind(currentLink?.provider === "youtube" || currentLink?.provider === "youtubeMusic" ? "youtube" : "other");
    setExternalUrl(currentLink?.url ?? "");
    setLinkModalVisible(true);
  }

  async function saveExternalLink() {
    if (!linkTarget) return;
    const cleanUrl = externalUrl.trim();

    if (!cleanUrl) {
      Alert.alert("Lien requis", "Ajoute une URL Spotify ou une autre source externe.");
      return;
    }

    if (!/^https?:\/\//i.test(cleanUrl)) {
      Alert.alert("Lien invalide", "Le lien doit commencer par http:// ou https://.");
      return;
    }

    if (externalLinkKind === "youtube" && !youtubeVideoIdFromUrl(cleanUrl)) {
      Alert.alert("Lien YouTube invalide", "Ajoute un lien YouTube ou YouTube Music contenant une video.");
      return;
    }

    if (externalLinkKind === "other") {
      const provider = detectExternalProvider(cleanUrl);
      if (provider === "youtube" || provider === "youtubeMusic") {
        Alert.alert("Choisis YouTube", "Ce lien est un lien YouTube. Selectionne YouTube pour utiliser le lecteur integre.");
        return;
      }
    }

    const withoutCurrent = externalLinks.filter((link) => {
      if (linkTarget.type === "category") return link.categoryId !== linkTarget.id;
      return true;
    });

    const nextLink: ExternalAudioLink = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: linkTarget.title,
      url: cleanUrl,
      provider: detectExternalProvider(cleanUrl),
      categoryId: linkTarget.type === "category" ? linkTarget.id : undefined,
      createdAt: new Date().toISOString()
    };

    await persistExternalLinks([...withoutCurrent, nextLink]);
    setExternalUrl("");
    setLinkTarget(null);
    setLinkModalVisible(false);
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
    // Afficher l'URI exact généré pour la configuration Spotify
    Alert.alert(
      "Spotify configuré",
      `Ajoute cette Redirect URI EXACTE dans Spotify Developer Dashboard :\n\n${spotifyRedirectUri}\n\nVérifiez que c'est exactement la même (majuscules, minuscules, barres obliques)`
    );
  }

  async function showSpotifyRedirectUri() {
    Alert.alert(
      "Redirect URI Spotify",
      `Voici le Redirect URI que vous devez ajouter dans le Spotify Developer Dashboard :\n\n${spotifyRedirectUri}`
    );
  }

  async function connectSpotify() {
    if (!spotifyClientId.trim()) {
      Alert.alert("Configuration requise", "Le développeur doit renseigner le Client ID Spotify dans src/config/spotify.ts.");
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
    // Même logique que favoritesFolderId
    const folderId = folderDetailVisible && selectedFolderId ? selectedFolderId : "global";
    const currentFavorites = favoriteCategoriesByFolder[folderId] || [];
    const nextFavorites = currentFavorites.includes(categoryId)
      ? currentFavorites.filter((id) => id !== categoryId)
      : [...currentFavorites, categoryId];
    
    const nextFavoriteCategoriesByFolder = {
      ...favoriteCategoriesByFolder,
      [folderId]: nextFavorites
    };
    
    setFavoriteCategoriesByFolder(nextFavoriteCategoriesByFolder);
    await storageService.saveFavoriteCategoriesByFolder(nextFavoriteCategoriesByFolder);
    scheduleSyncPush();
  }

  async function createScene() {
    // Si on édite une scène existante, utiliser updateScene
    if (editingCustomSoundId) {
      await updateScene();
      return;
    }

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
      folderId: folderDetailVisible ? selectedFolderId : undefined,
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
    setActiveLoopIds([]);
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

  async function editScene(scene: Scene) {
    setSceneName(scene.name);
    setSceneDescription(scene.description || "");
    setSceneLink(scene.externalLink || "");
    setTransitionMinutes(scene.transitionMinutes ? String(scene.transitionMinutes) : "");
    
    // Restaurer les sons actifs de la scène
    setActiveLoopIds(scene.sounds.map(s => s.soundId));
    
    // Marquer cette scène pour édition
    setEditingCustomSoundId(scene.id);
    setSceneModalVisible(true);
  }

  async function deleteScene(sceneId: string) {
    Alert.alert(
      "Supprimer la scène",
      "Êtes-vous sûr de vouloir supprimer cette scène ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            await persistScenes(scenes.filter(s => s.id !== sceneId));
          }
        }
      ]
    );
  }

  async function updateScene() {
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

    const sceneId = editingCustomSoundId as string;
    const updatedScene: Scene = {
      ...scenes.find(s => s.id === sceneId)!,
      name: sceneName.trim(),
      description: sceneDescription.trim() || undefined,
      sounds: selectedSounds.map((sound) => ({
        soundId: sound.id,
        track: sound.track,
        volume: 1
      })),
      externalLink: cleanLink || undefined,
      externalProvider: cleanLink ? detectExternalProvider(cleanLink) : undefined,
      transitionMinutes: Number(transitionMinutes) > 0 ? Number(transitionMinutes) : undefined
    };

    await persistScenes(scenes.map(s => s.id === sceneId ? updatedScene : s));
    setSceneName("");
    setSceneDescription("");
    setSceneLink("");
    setTransitionMinutes("");
    setEditingCustomSoundId(null);
    setSceneModalVisible(false);
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
    stopYoutubePlayer();
    await audioService.stopAllLoops();
    setActiveLoopIds([]);

    if (spotifyTokens?.accessToken && isSpotifyTokenFresh(spotifyTokens)) {
      const spotifyStopTargets = [selectedSpotifyDeviceId];

      try {
        const freshDevices = await getSpotifyDevices(spotifyTokens.accessToken);
        setSpotifyDevices(freshDevices);
        spotifyStopTargets.push(
          ...freshDevices.filter((device) => device.is_active || device.id === selectedSpotifyDeviceId).map((device) => device.id ?? "")
        );
      } catch {
        // La pause globale ci-dessous peut fonctionner même si Spotify refuse la liste des appareils.
      }

      try {
        await forceStopSpotifyPlayback(spotifyTokens.accessToken, spotifyStopTargets);
      } catch {
        Alert.alert(
          "Spotify non arrêté",
          "Spotify n'a pas accepté la commande pause. Vérifie qu'un appareil Spotify actif est sélectionné."
        );
      }
    }
  }

  const youtubeVideoId = youtubePlayer ? youtubeVideoIdFromUrl(youtubePlayer.url) : undefined;

  return (
    <View style={styles.screen}>
      {sessionMode && selectedFolderId ? (
        <SessionScreen
          selectedFolderId={selectedFolderId}
          soundFolders={soundFolders}
          scenes={scenes}
          customSounds={customSounds}
          campaignImages={campaignImages}
          categorySounds={categorySounds}
          categoryExternalLinks={categoryExternalLinks}
          quickSounds={quickSounds}
          customSoundAssets={customSoundAssets}
          activeLoopIds={activeLoopIds}
          onPlayScene={playScene}
          onToggleCategoryPlayback={toggleCategoryPlayback}
          onPlayGeneralQuickEffect={playQuickEffect}
          onPlayQuickSound={playCustomQuickSound}
          onToggleAmbiance={toggleCustomAmbient}
          onStopAll={stopAll}
          onExit={() => setSessionMode(false)}
        />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: styles.content.paddingBottom + insets.bottom }]}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Table sonore du maître de jeu</Text>
          <Text style={styles.title}>JDR Ambiances</Text>
          <View style={styles.planRow}>
            <Text style={[styles.planBadge, isPremium && styles.planBadgePremium]}>{isPremium ? "Premium" : "Gratuit - campagnes verrouillees"}</Text>
            <AppButton compact icon="user" label="Compte" onPress={() => setAccountModalVisible(true)} />
          </View>
          <View style={styles.heroActions}>
            <AppButton icon="save" label="Créer une scène" tone="primary" onPress={() => setSceneModalVisible(true)} style={styles.heroButton} />
            <AppButton icon="stop" label="Tout arrêter" tone="danger" onPress={stopAll} style={styles.heroButton} />
          </View>
        </View>

        {folderDetailVisible && selectedFolder ? (
          <View>
            <AppButton compact icon="arrow-left" label="Retour" onPress={() => setFolderDetailVisible(false)} style={styles.backButton} />
            <Section title={selectedFolder.name} icon={selectedFolder.icon}>
              <View style={styles.customPanel}>
                <View style={styles.customHeader}>
                  <Text style={styles.customTitle}>Sons de la campagne</Text>
                  <View style={styles.customActions}>
                    <AppButton compact icon="dice-d20" label={sessionMode ? "Gestion" : "Session"} tone={sessionMode ? "secondary" : "primary"} onPress={() => setSessionMode((value) => !value)} />
                    <AppButton compact icon={dmLocked ? "lock" : "lock-open"} label={dmLocked ? "Verrouillé" : "Déverrouillé"} onPress={() => setDmLocked((value) => !value)} />
                    {!sessionMode ? (
                      <>
                        <AppButton compact icon="music" label="Ambiance" disabled={dmLocked} onPress={() => openCustomSoundModal("ambient")} />
                        <AppButton compact icon="bolt" label="Rapide" disabled={dmLocked} onPress={() => openCustomSoundModal("quick")} />
                        <AppButton compact icon="save" label="Scène" disabled={dmLocked} onPress={() => setSceneModalVisible(true)} />
                        <AppButton compact icon="trash" label="Supprimer" tone="danger" disabled={dmLocked} onPress={confirmDeleteSelectedFolder} />
                      </>
                    ) : null}
                  </View>
                </View>
                {selectedFolderScenes.length > 0 ? (
                  <View style={styles.sceneList}>
                    <Text style={styles.customTitle}>Scenes de la campagne</Text>
                    {selectedFolderScenes.map((scene) => (
                      <View key={scene.id} style={styles.sessionSceneRow}>
                        <View style={styles.sceneCopy}>
                          <Text numberOfLines={1} style={styles.sceneTitle}>{scene.name}</Text>
                          <Text style={styles.sceneMeta}>{sceneEntryCount(scene)} element(s){scene.externalLink ? " dont 1 lien" : ""}{scene.transitionMinutes ? ` · ${scene.transitionMinutes} min` : ""}</Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <AppButton compact icon="star" label="" tone={scene.favorite ? "primary" : "secondary"} onPress={() => toggleFavoriteScene(scene.id)} />
                          <AppButton compact icon="edit" label="Éditer" tone="secondary" onPress={() => editScene(scene)} />
                          <AppButton compact icon="trash" label="Supprimer" tone="danger" onPress={() => deleteScene(scene.id)} />
                          <AppButton compact icon="play" label="Lancer" tone="primary" onPress={() => playScene(scene)} />
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
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
                      <Text style={styles.imageFolderMeta}>
                        {selectedFolderImages.length} image(s) dans cette campagne
                      </Text>
                    </View>
                    <FontAwesome5 name={imageFolderOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
                  </Pressable>
                  {imageFolderOpen ? (
                    <View style={styles.imageFolderContent}>
                      <View style={styles.customActions}>
                        <AppButton compact icon="image" label="Telephone" disabled={dmLocked} onPress={addCampaignImageFromPhone} />
                        <AppButton compact icon="link" label="Lien image" disabled={dmLocked} onPress={openImageLinkModal} />
                      </View>
                      <TextInput
                        value={imageSearch}
                        onChangeText={setImageSearch}
                        placeholder="Rechercher une image..."
                        placeholderTextColor={colors.muted}
                        autoCapitalize="none"
                        style={styles.imageSearchInput}
                      />
                      {selectedFolderImages.length > 0 ? (
                        <View style={styles.imageGrid}>
                          {visibleFolderImages.map((image) => (
                            <View key={image.id} style={styles.imageCard}>
                              <Pressable accessibilityRole="imagebutton" onPress={() => setPreviewImage(image)}>
                                <Image source={{ uri: image.uri }} style={styles.campaignImage} resizeMode="cover" />
                              </Pressable>
                              <View style={styles.imageCopy}>
                                <Text numberOfLines={1} style={styles.imageTitle}>{image.title}</Text>
                                <Text style={styles.imageMeta}>{image.source === "local" ? "Image locale" : "Lien externe"}</Text>
                              </View>
                              <View style={styles.imageActions}>
                                {image.source === "link" ? (
                                  <AppButton compact icon="external-link-alt" label="" onPress={() => Linking.openURL(image.uri)} style={styles.iconOnlyAction} />
                                ) : null}
                                <AppButton compact icon="edit" label="" disabled={dmLocked} onPress={() => openRenameCampaignImage(image)} style={styles.iconOnlyAction} />
                                <AppButton compact icon="trash" label="" tone="danger" disabled={dmLocked} onPress={() => deleteCampaignImage(image.id)} style={styles.iconOnlyAction} />
                              </View>
                            </View>
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
                {visibleFolderAmbiences.length > 0 ? (
                  <View style={styles.categoryGrid}>
                    {visibleFolderAmbiences.map((item) => {
                      const asset = customSoundAssets[item.id];
                      return (
                        <View key={item.id} style={styles.customAmbientItem}>
                        <CategoryCard
                          style={styles.fullWidthCard}
                          category={{
                            id: item.id,
                            title: item.title,
                            description: item.section?.trim() || "Aucune description.",
                            icon: item.icon,
                            accent: item.accent
                          }}
                          hasAudio={Boolean(asset)}
                          externalLabel={item.externalLink ? externalButtonLabel(item.externalProvider) : undefined}
                          readOnly={sessionMode}
                          isPlaying={Boolean(asset && activeLoopIds.includes(asset.id))}
                          favorite={false}
                          allowSourceReplacement={false}
                          onTogglePlay={() => toggleCustomAmbient(item.id)}
                          onImport={async () => {
                            const nextAsset = await importAudioFile({
                              title: item.title,
                              track: item.track,
                              folderId: item.folderId,
                              customSoundId: item.id
                            });
                            if (nextAsset) await persistSounds([...sounds, nextAsset]);
                          }}
                          onAttachExternalLink={() => openEditCustomSoundModal(item)}
                          onOpenDetails={() => openAmbientDetail({ title: item.title, description: item.section, icon: item.icon, accent: item.accent })}
                          onToggleFavorite={() => undefined}
                        />
                        {!sessionMode ? (
                          <View style={styles.itemActions}>
                            <AppButton compact icon="edit" label="Modifier" disabled={dmLocked} onPress={() => openEditCustomSoundModal(item)} style={styles.itemActionButton} />
                            <AppButton compact icon="trash" label="Supprimer" tone="danger" disabled={dmLocked} onPress={() => confirmDeleteCustomSound(item)} style={styles.itemActionButton} />
                          </View>
                        ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.empty}>Aucune ambiance dans cette campagne.</Text>
                )}
                {visibleFolderQuickSounds.length > 0 ? (
                  <View style={styles.quickGrid}>
                    {visibleFolderQuickSounds.map((item) => (
                      <View key={item.id} style={styles.customQuickItem}>
                      <QuickSoundPad
                        effect={{ id: item.id, title: item.title, icon: item.icon, accent: item.accent }}
                        hasAudio={Boolean(customSoundAssets[item.id])}
                        readOnly={sessionMode}
                        onPlay={() => playCustomQuickSound(item.id)}
                        onImport={async () => {
                          const nextAsset = await importAudioFile({
                            title: item.title,
                            track: item.track,
                            folderId: item.folderId,
                            customSoundId: item.id
                          });
                          if (nextAsset) await persistSounds([...sounds, nextAsset]);
                        }}
                      />
                      <View style={styles.quickItemActions}>
                        {!sessionMode ? <AppButton compact icon="edit" label="" disabled={dmLocked} onPress={() => openEditCustomSoundModal(item)} style={styles.iconOnlyAction} /> : null}
                        {!sessionMode ? <AppButton compact icon="trash" label="" tone="danger" disabled={dmLocked} onPress={() => confirmDeleteCustomSound(item)} style={styles.iconOnlyAction} /> : null}
                      </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.empty}>Aucun son rapide dans cette campagne.</Text>
                )}
              </View>
            </Section>

            {(currentFavoriteCategoryIds.length > 0 || favoriteScenes.length > 0) && (
              <Section title="Favoris de la campagne">
                <View style={styles.favoriteRail}>
                  {currentFavoriteCategoryIds.map((id) => {
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
                  {favoriteScenes.filter((scene) => scene.folderId === selectedFolderId).map((scene) => (
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
                      favorite={currentFavoriteCategoryIds.includes(category.id)}
                      allowSourceReplacement={false}
                      singleAddAction
                      onTogglePlay={() => toggleCategoryPlayback(category.id)}
                      onImport={() => openCategorySourceChoice(category.id, category.title)}
                      onAttachExternalLink={() => openExternalLinkModal({ type: "category", id: category.id, title: category.title })}
                      onDeleteAudio={() => confirmDeleteCategorySound(category.id)}
                      onDeleteExternalLink={() => confirmDeleteCategoryLink(category.id)}
                      onOpenDetails={() => openAmbientDetail(category)}
                      onToggleFavorite={() => toggleFavoriteCategory(category.id)}
                    />
                  );
                })}
              </View>
            </Section>

            <Section title="Sons rapides">
              <View style={styles.quickGrid}>
                {quickEffects.map((effect) => (
                  <QuickSoundPad
                    key={effect.id}
                    effect={effect}
                    columns={quickColumns}
                    large={quickColumns === 3}
                    hasAudio={Boolean(quickSounds[effect.id])}
                    onPlay={() => playQuickEffect(effect.id)}
                    onImport={() => importForQuickEffect(effect.id)}
                  />
                ))}
              </View>
            </Section>
          </View>
        ) : (
          <>


        <Section title="Spotify">
          <View style={styles.panel}>
            <View style={styles.spotifyHeader}>
              <View style={styles.spotifyCopy}>
                <Text style={styles.spotifyTitle}>{spotifyTokens ? "Compte connecté" : "Compte non connecté"}</Text>
                <Text style={styles.spotifyHint}>
                  {spotifyTokens
                    ? spotifyProfileName || "Spotify est pret pour les liens externes."
                    : SPOTIFY_CLIENT_ID
                      ? "Connecte Spotify pour lancer les playlists, albums et titres."
                      : "Client ID Spotify manquant dans la configuration développeur."}
                </Text>
              </View>
              {spotifyTokens ? (
                <AppButton compact icon="sign-out-alt" label="Déconnecter" tone="danger" onPress={disconnectSpotify} />
              ) : (
                <AppButton compact icon="spotify" label="Connecter" tone="primary" disabled={!spotifyClientId.trim() || !spotifyRequest} onPress={connectSpotify} />
              )}
            </View>
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

        <Section title="Campagnes JDR">
          <View style={styles.folderRail}>
            {soundFolders.map((folder) => (
              <Pressable
                key={folder.id}
                accessibilityRole="button"
                onPress={() => {
                  if (!folderAccess) {
                    setPaywallModalVisible(true);
                    return;
                  }

                  setSelectedFolderId(folder.id);
                  setFolderDetailVisible(true);
                }}
                style={[styles.folderButton, selectedFolderId === folder.id && styles.folderButtonSelected]}
              >
                <FontAwesome5 name={folder.icon as never} size={14} color={selectedFolderId === folder.id ? colors.gold : colors.text} />
                <Text numberOfLines={1} style={[styles.folderName, selectedFolderId === folder.id && styles.folderNameSelected]}>
                  {folder.name}
                </Text>
              </Pressable>
            ))}
            <AppButton compact icon="plus" label="Campagne" tone="primary" onPress={openFolderCreation} />
          </View>
          {!folderAccess ? (
            <Text style={styles.planHint}>
              Le mode campagne demande un compte Premium. Passe en Premium pour creer et ouvrir tes campagnes JDR.
            </Text>
          ) : null}
          {false && selectedFolder ? (
            <View style={styles.customPanel}>
              <View style={styles.customHeader}>
                <Text style={styles.customTitle}>{selectedFolder?.name}</Text>
                <View style={styles.customActions}>
                  <AppButton compact icon="music" label="Ambiance" onPress={() => openCustomSoundModal("ambient")} />
                  <AppButton compact icon="bolt" label="Rapide" onPress={() => openCustomSoundModal("quick")} />
                </View>
              </View>
              {selectedFolderAmbiences.length > 0 ? (
                <View style={styles.categoryGrid}>
                  {selectedFolderAmbiences.map((item) => {
                    const asset = customSoundAssets[item.id];
                    return (
                      <CategoryCard
                        style={styles.fullWidthCard}
                        key={item.id}
                        category={{
                          id: item.id,
                          title: item.title,
                          description: item.section?.trim() || "Aucune description.",
                          icon: item.icon,
                          accent: item.accent
                        }}
                        hasAudio={Boolean(asset)}
                        isPlaying={Boolean(asset && activeLoopIds.includes(asset.id))}
                        favorite={false}
                        allowSourceReplacement={false}
                        onTogglePlay={() => toggleCustomAmbient(item.id)}
                        onImport={async () => {
                          const nextAsset = await importAudioFile({
                            title: item.title,
                            track: item.track,
                            folderId: item.folderId,
                            customSoundId: item.id
                          });
                          if (nextAsset) await persistSounds([...sounds, nextAsset]);
                        }}
                        onAttachExternalLink={() => openEditCustomSoundModal(item)}
                        onOpenDetails={() => openAmbientDetail({ title: item.title, description: item.section, icon: item.icon, accent: item.accent })}
                        onToggleFavorite={() => undefined}
                      />
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.empty}>Aucune ambiance dans cette campagne.</Text>
              )}
              {selectedFolderQuickSounds.length > 0 ? (
                <View style={styles.quickGrid}>
                  {selectedFolderQuickSounds.map((item) => (
                    <View key={item.id} style={styles.customQuickItem}>
                    <QuickSoundPad
                      effect={{ id: item.id, title: item.title, icon: item.icon, accent: item.accent }}
                      hasAudio={Boolean(customSoundAssets[item.id])}
                      onPlay={() => playCustomQuickSound(item.id)}
                      onImport={async () => {
                        const nextAsset = await importAudioFile({
                          title: item.title,
                          track: item.track,
                          folderId: item.folderId,
                          customSoundId: item.id
                        });
                        if (nextAsset) await persistSounds([...sounds, nextAsset]);
                      }}
                    />
                      <View style={styles.quickItemActions}>
                        <AppButton compact icon="edit" label="" onPress={() => openEditCustomSoundModal(item)} style={styles.iconOnlyAction} />
                        <AppButton compact icon="trash" label="" tone="danger" onPress={() => confirmDeleteCustomSound(item)} style={styles.iconOnlyAction} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.empty}>Aucun son rapide dans cette campagne.</Text>
              )}
            </View>
          ) : (
            <Text style={styles.empty}>Cree une campagne pour preparer les sons d'un JDR.</Text>
          )}
        </Section>

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
                  favorite={currentFavoriteCategoryIds.includes(category.id)}
                  allowSourceReplacement={false}
                  singleAddAction
                  onTogglePlay={() => toggleCategoryPlayback(category.id)}
                  onImport={() => openCategorySourceChoice(category.id, category.title)}
                  onAttachExternalLink={() => openExternalLinkModal({ type: "category", id: category.id, title: category.title })}
                  onDeleteAudio={() => confirmDeleteCategorySound(category.id)}
                  onDeleteExternalLink={() => confirmDeleteCategoryLink(category.id)}
                  onOpenDetails={() => openAmbientDetail(category)}
                  onToggleFavorite={() => toggleFavoriteCategory(category.id)}
                />
              );
            })}
          </View>
        </Section>

        <Section title="Sons rapides">
          <View style={styles.quickControls}>
            {[3, 4, 5].map((columns) => (
              <AppButton
                key={columns}
                compact
                icon="th"
                label={`${columns} colonnes`}
                tone={quickColumns === columns ? "primary" : "secondary"}
                onPress={() => setQuickColumns(columns)}
              />
            ))}
          </View>
          <View style={styles.quickGrid}>
            {quickEffects.map((effect) => (
              <QuickSoundPad
                key={effect.id}
                effect={effect}
                columns={quickColumns}
                large={quickColumns === 3}
                hasAudio={Boolean(quickSounds[effect.id])}
                onPlay={() => playQuickEffect(effect.id)}
                onImport={() => importForQuickEffect(effect.id)}
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
                      {sceneEntryCount(scene)} element(s){scene.externalLink ? " dont 1 lien" : ""}{scene.transitionMinutes ? ` · transition ${scene.transitionMinutes} min` : ""}
                    </Text>
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => toggleFavoriteScene(scene.id)} style={styles.starButton}>
                    <Text style={[styles.starText, scene.favorite && styles.starActive]}>★</Text>
                  </Pressable>
                </View>
                <View style={styles.sceneActions}>
                  <AppButton compact icon="edit" label="Éditer" tone="secondary" onPress={() => editScene(scene)} style={styles.sceneButton} />
                  <AppButton compact icon="trash" label="Supprimer" tone="danger" onPress={() => deleteScene(scene.id)} style={styles.sceneButton} />
                  <AppButton compact icon="play" label="Lancer" tone="primary" onPress={() => playScene(scene)} style={styles.sceneButton} />
                  {scene.transitionMinutes ? (
                    <AppButton compact icon="clock" label="Programmer" onPress={() => scheduleScene(scene)} style={styles.sceneButton} />
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </Section>
          </>
        )}
      </ScrollView>
      )}

      <Modal visible={sceneModalVisible} animationType="slide" transparent onRequestClose={() => setSceneModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modalCard, modalSafeAreaStyle]}>
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
              placeholder="Lien externe Spotify, YouTube Music, YouTube ou web"
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
              <AppButton 
                label="Annuler" 
                onPress={() => {
                  setSceneModalVisible(false);
                  setSceneName("");
                  setSceneDescription("");
                  setSceneLink("");
                  setTransitionMinutes("");
                  setEditingCustomSoundId(null);
                  setActiveLoopIds([]);
                }} 
                style={styles.modalButton} 
              />
              <AppButton 
                label={editingCustomSoundId ? "Modifier" : "Créer"} 
                icon="save" 
                tone="primary" 
                onPress={createScene} 
                style={styles.modalButton} 
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={folderModalVisible} animationType="slide" transparent onRequestClose={() => setFolderModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modalCard, modalSafeAreaStyle]}>
            <Text style={styles.modalTitle}>Nouvelle campagne JDR</Text>
            
            {/* Sélection de template */}
            
            <TextInput
              value={folderName}
              onChangeText={setFolderName}
              placeholder="Storm, Curse of Strahd, One-shot..."
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <Text style={styles.modalHint}>Choisis une icône</Text>
            <View style={styles.iconGrid}>
              {iconChoices.map((icon) => (
                <Pressable
                  key={icon}
                  accessibilityRole="button"
                  onPress={() => setFolderIcon(icon)}
                  style={[styles.iconChoice, folderIcon === icon && styles.iconChoiceSelected]}
                >
                  <FontAwesome5 name={icon as never} size={18} color={folderIcon === icon ? colors.gold : colors.text} />
                </Pressable>
              ))}
            </View>
            <View style={styles.modalActions}>
              <AppButton label="Annuler" onPress={() => setFolderModalVisible(false)} style={styles.modalButton} />
              <AppButton label="Créer" icon="folder-plus" tone="primary" onPress={createSoundFolder} style={styles.modalButton} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={accountModalVisible} animationType="slide" transparent onRequestClose={() => setAccountModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modalCard, modalSafeAreaStyle]}>
            <Text style={styles.modalTitle}>Compte</Text>
            <Text style={styles.modalHint}>
              Offre actuelle : {isPremium ? "Premium" : "Gratuit"}. Le mode campagne est reserve au Premium.
            </Text>
            <Text style={styles.accountEmail}>
              {localUser ? localUser.email : "Aucun compte connecte"}
            </Text>
            {premiumSince ? (
              <Text style={styles.planText}>Premium actif depuis le {new Date(premiumSince).toLocaleDateString("fr-FR")}</Text>
            ) : null}
            <View style={styles.planCard}>
              <FontAwesome5 name={isPremium ? "crown" : "lock"} size={20} color={isPremium ? colors.gold : colors.muted} />
              <View style={styles.planCopy}>
                <Text style={styles.planTitle}>{isPremium ? "Mode Premium actif" : "Mode gratuit"}</Text>
                <Text style={styles.planText}>
                  {isPremium ? "Tu peux creer et ouvrir autant de campagnes JDR que necessaire." : "Les campagnes JDR sont verrouillees en mode gratuit."}
                </Text>
              </View>
            </View>
            <View style={styles.modalActions}>
              <AppButton label="Fermer" onPress={() => setAccountModalVisible(false)} style={styles.modalButton} />
              {localUser ? (
                <AppButton label="Deconnexion" icon="sign-out-alt" tone="danger" onPress={signOutLocalUser} style={styles.modalButton} />
              ) : (
                <AppButton label="Connexion" icon="sign-in-alt" onPress={() => openAuthModal("login")} style={styles.modalButton} />
              )}
            </View>
            <View style={styles.modalActions}>
              {isPremium ? (
                <AppButton label="Revenir gratuit" icon="undo" onPress={() => updateSubscriptionTier("free")} style={styles.modalButton} />
              ) : localUser ? (
                <AppButton label="Activer Premium" icon="crown" tone="primary" onPress={() => activatePremium(false)} style={styles.modalButton} />
              ) : (
                <AppButton label="Creer un compte" icon="user-plus" tone="primary" onPress={() => openAuthModal("signup")} style={styles.modalButton} />
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={paywallModalVisible} animationType="slide" transparent onRequestClose={() => setPaywallModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modalCard, modalSafeAreaStyle]}>
            <Text style={styles.modalTitle}>Mode Premium</Text>
            <Text style={styles.modalHint}>
              Le mode campagne est reserve au Premium. Tu gardes les ambiances, sons rapides et liens externes en gratuit.
            </Text>
            {!localUser ? (
              <Text style={styles.modalHint}>Un compte sera demande avant le paiement test.</Text>
            ) : null}
            <View style={styles.premiumList}>
              <Text style={styles.premiumItem}>Campagnes JDR illimitees</Text>
              <Text style={styles.premiumItem}>Sons personnalises par campagne</Text>
              <Text style={styles.premiumItem}>Sections, scenes et mode session par campagne</Text>
            </View>
            <View style={styles.modalActions}>
              <AppButton label="Plus tard" onPress={() => setPaywallModalVisible(false)} style={styles.modalButton} />
              <AppButton label="Activer Premium" icon="crown" tone="primary" onPress={() => activatePremium(true)} style={styles.modalButton} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={paymentModalVisible} animationType="slide" transparent onRequestClose={() => setPaymentModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modalCard, modalSafeAreaStyle]}>
            <Text style={styles.modalTitle}>Paiement Premium</Text>
            <Text style={styles.modalHint}>
              Le paiement reel n'est pas encore branche. Ce tunnel prepare Stripe ou l'achat mobile, avec une validation test pour continuer le developpement.
            </Text>
            <View style={styles.planCard}>
              <FontAwesome5 name="credit-card" size={20} color={colors.gold} />
              <View style={styles.planCopy}>
                <Text style={styles.planTitle}>Mode test</Text>
                <Text style={styles.planText}>Aucune carte bancaire n'est demandee pour l'instant.</Text>
              </View>
            </View>
            <View style={styles.modalActions}>
              <AppButton
                label="Annuler"
                disabled={paymentLoading}
                onPress={() => {
                  setPaymentModalVisible(false);
                  setPendingPremiumFolderOpen(false);
                }}
                style={styles.modalButton}
              />
              <AppButton
                label={paymentLoading ? "Validation..." : "Continuer en test"}
                icon="check"
                tone="primary"
                disabled={paymentLoading}
                onPress={confirmMockPayment}
                style={styles.modalButton}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={authModalVisible} animationType="slide" transparent onRequestClose={() => setAuthModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modalCard, modalSafeAreaStyle]}>
            <Text style={styles.modalTitle}>{authMode === "signup" ? "Creer un compte" : "Connexion"}</Text>
            <Text style={styles.modalHint}>
              {pendingPremiumActivation
                ? "Connecte-toi pour rattacher le Premium a ton compte."
                : "Connecte-toi pour preparer le futur espace utilisateur."}
            </Text>
            <TextInput
              value={authEmail}
              onChangeText={setAuthEmail}
              placeholder="email@exemple.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <TextInput
              value={authPassword}
              onChangeText={setAuthPassword}
              placeholder="Mot de passe"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={styles.input}
            />
            <View style={styles.authSwitch}>
              <AppButton
                compact
                label={authMode === "signup" ? "J'ai deja un compte" : "Creer un compte"}
                icon={authMode === "signup" ? "sign-in-alt" : "user-plus"}
                disabled={authLoading}
                onPress={() => setAuthMode(authMode === "signup" ? "login" : "signup")}
              />
            </View>
            <View style={styles.modalActions}>
              <AppButton
                label="Annuler"
                disabled={authLoading}
                onPress={() => {
                  setAuthModalVisible(false);
                  setPendingPremiumActivation(false);
                  setPendingPremiumFolderOpen(false);
                }}
                style={styles.modalButton}
              />
              <AppButton
                label={authLoading ? "Chargement..." : authMode === "signup" ? "Creer" : "Se connecter"}
                icon={authMode === "signup" ? "user-plus" : "sign-in-alt"}
                tone="primary"
                disabled={authLoading}
                onPress={submitAuth}
                style={styles.modalButton}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={imageModalVisible} animationType="slide" transparent onRequestClose={() => setImageModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modalCard, modalSafeAreaStyle]}>
            <Text style={styles.modalTitle}>Lien d'image</Text>
            <TextInput
              value={imageName}
              onChangeText={setImageName}
              placeholder="Nom optionnel"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <TextInput
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="https://exemple.com/image.jpg"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="url"
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <AppButton label="Annuler" onPress={() => setImageModalVisible(false)} style={styles.modalButton} />
              <AppButton label="Sauvegarder" icon="image" tone="primary" onPress={saveCampaignImageLink} style={styles.modalButton} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={Boolean(renamingImage)} animationType="slide" transparent onRequestClose={() => setRenamingImage(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modalCard, modalSafeAreaStyle]}>
            <Text style={styles.modalTitle}>Renommer l'image</Text>
            <TextInput
              value={imageRenameName}
              onChangeText={setImageRenameName}
              placeholder="Nom de l'image"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <AppButton label="Annuler" onPress={() => setRenamingImage(null)} style={styles.modalButton} />
              <AppButton label="Sauvegarder" icon="save" tone="primary" onPress={saveCampaignImageName} style={styles.modalButton} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={Boolean(previewImage)} animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <View style={styles.imagePreviewScreen}>
          <Pressable accessibilityRole="button" onPress={() => setPreviewImage(null)} style={styles.imagePreviewClose}>
            <FontAwesome5 name="times" size={20} color={colors.text} />
          </Pressable>
          {previewImage ? (
            <>
              <Image source={{ uri: previewImage.uri }} style={styles.imagePreview} resizeMode="contain" />
              <Text numberOfLines={2} style={styles.imagePreviewTitle}>{previewImage.title}</Text>
            </>
          ) : null}
        </View>
      </Modal>

      <Modal visible={Boolean(ambientDetail)} animationType="slide" transparent onRequestClose={() => setAmbientDetail(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modalCard, modalSafeAreaStyle]}>
            {ambientDetail ? (
              <>
                <View style={styles.ambientDetailHeader}>
                  <View style={[styles.ambientDetailIcon, { backgroundColor: `${ambientDetail.accent}22` }]}>
                    <FontAwesome5 name={ambientDetail.icon as never} size={24} color={ambientDetail.accent} />
                  </View>
                  <Text style={styles.modalTitle}>{ambientDetail.title}</Text>
                </View>
                <Text style={styles.ambientDetailText}>{ambientDetail.description}</Text>
                <View style={styles.modalActions}>
                  <AppButton label="Fermer" onPress={() => setAmbientDetail(null)} style={styles.modalButton} />
                </View>
              </>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={customSoundModalVisible} animationType="slide" transparent onRequestClose={() => setCustomSoundModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.tallModalCard, modalSafeAreaStyle]}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScroll}>
            <Text style={styles.modalTitle}>
              {editingCustomSoundId ? "Modifier le son" : customSoundKind === "ambient" ? "Nouvelle ambiance" : "Nouveau son rapide"}
            </Text>
            <View style={styles.modalActions}>
              <AppButton label="Ambiance" icon="music" tone={customSoundKind === "ambient" ? "primary" : "secondary"} onPress={() => setCustomSoundKind("ambient")} style={styles.modalButton} />
              <AppButton
                label="Rapide"
                icon="bolt"
                tone={customSoundKind === "quick" ? "primary" : "secondary"}
                onPress={() => {
                  setCustomSoundKind("quick");
                  setCustomSoundSource("mobile");
                  setCustomSoundExternalUrl("");
                }}
                style={styles.modalButton}
              />
            </View>
            <TextInput
              value={customSoundName}
              onChangeText={setCustomSoundName}
              placeholder="Nom du son"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <TextInput
              value={customSoundSection}
              onChangeText={setCustomSoundSection}
              placeholder="Description optionnelle"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            {customSoundKind === "ambient" ? (
              <View style={styles.choiceGroup}>
                <Text style={styles.modalHint}>Source du son</Text>
                <View style={styles.modalActions}>
                  <AppButton
                    label="Mobile"
                    icon="file-audio"
                    tone={customSoundSource === "mobile" ? "primary" : "secondary"}
                    onPress={() => setCustomSoundSource("mobile")}
                    style={styles.modalButton}
                  />
                  <AppButton
                    label="Externe"
                    icon="external-link-alt"
                    tone={customSoundSource === "external" ? "primary" : "secondary"}
                    onPress={() => setCustomSoundSource("external")}
                    style={styles.modalButton}
                  />
                </View>
              </View>
            ) : null}
            {customSoundSource === "external" && customSoundKind === "ambient" ? (
              <View style={styles.choiceGroup}>
                <Text style={styles.modalHint}>Type de lien</Text>
                <View style={styles.modalActions}>
                  <AppButton
                    label="YouTube"
                    icon="youtube"
                    tone={customSoundExternalKind === "youtube" ? "primary" : "secondary"}
                    onPress={() => setCustomSoundExternalKind("youtube")}
                    style={styles.modalButton}
                  />
                  <AppButton
                    label="Autre"
                    icon="link"
                    tone={customSoundExternalKind === "other" ? "primary" : "secondary"}
                    onPress={() => setCustomSoundExternalKind("other")}
                    style={styles.modalButton}
                  />
                </View>
                <TextInput
                  value={customSoundExternalUrl}
                  onChangeText={setCustomSoundExternalUrl}
                  placeholder={customSoundExternalKind === "youtube" ? "Lien YouTube ou YouTube Music" : "Lien Spotify ou web"}
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  keyboardType="url"
                  style={styles.input}
                />
              </View>
            ) : (
              <View style={styles.filePickerRow}>
                <View style={styles.filePickerCopy}>
                  <Text style={styles.filePickerTitle}>Fichier du telephone</Text>
                  <Text numberOfLines={1} style={styles.filePickerName}>
                    {customSoundPickedFile?.name ?? "Aucun fichier selectionne"}
                  </Text>
                </View>
                <AppButton compact icon="file-audio" label="Choisir" onPress={chooseCustomSoundFile} />
              </View>
            )}
            <Text style={styles.modalHint}>Choisis une couleur</Text>
            <View style={styles.colorGrid}>
              {accentChoices.map((accent) => (
                <Pressable
                  key={accent}
                  accessibilityRole="button"
                  onPress={() => setCustomSoundAccent(accent)}
                  style={[styles.colorChoice, { backgroundColor: accent }, customSoundAccent === accent && styles.colorChoiceSelected]}
                />
              ))}
            </View>
            <Text style={styles.modalHint}>Choisis une icône</Text>
            <View style={styles.iconGrid}>
              {iconChoices.map((icon) => (
                <Pressable
                  key={icon}
                  accessibilityRole="button"
                  onPress={() => setCustomSoundIcon(icon)}
                  style={[styles.iconChoice, customSoundIcon === icon && styles.iconChoiceSelected]}
                >
                  <FontAwesome5 name={icon as never} size={18} color={customSoundIcon === icon ? colors.gold : colors.text} />
                </Pressable>
              ))}
            </View>
            <Text style={styles.modalHint}>
              {customSoundKind === "ambient"
                ? "YouTube et YouTube Music utilisent le lecteur integre. Les autres liens gardent leur logique actuelle."
                : "Choisis un fichier audio local depuis le telephone, puis valide."}
            </Text>
            <View style={styles.modalActions}>
              <AppButton label="Annuler" onPress={() => setCustomSoundModalVisible(false)} style={styles.modalButton} />
              <AppButton label={editingCustomSoundId ? "Sauvegarder" : "Valider"} icon="save" tone="primary" onPress={createCustomSound} style={styles.modalButton} />
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={linkModalVisible} animationType="slide" transparent onRequestClose={() => setLinkModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modalCard, modalSafeAreaStyle]}>
            <Text style={styles.modalTitle}>Lien externe</Text>
            <Text style={styles.modalHint}>{linkTarget?.title}</Text>
            <View style={styles.modalActions}>
              <AppButton
                label="YouTube"
                icon="youtube"
                tone={externalLinkKind === "youtube" ? "primary" : "secondary"}
                onPress={() => setExternalLinkKind("youtube")}
                style={styles.modalButton}
              />
              <AppButton
                label="Autre"
                icon="link"
                tone={externalLinkKind === "other" ? "primary" : "secondary"}
                onPress={() => setExternalLinkKind("other")}
                style={styles.modalButton}
              />
            </View>
            <TextInput
              value={externalUrl}
              onChangeText={setExternalUrl}
              placeholder={externalLinkKind === "youtube" ? "https://youtu.be/... ou music.youtube.com/..." : "https://open.spotify.com/... ou https://..."}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="url"
              style={styles.input}
            />
            <Text style={styles.modalHint}>
              YouTube et YouTube Music utilisent le lecteur integre. Les autres liens gardent leur logique actuelle.
            </Text>
            <View style={styles.modalActions}>
              <AppButton label="Annuler" onPress={() => setLinkModalVisible(false)} style={styles.modalButton} />
              <AppButton label="Sauvegarder" icon="link" tone="primary" onPress={saveExternalLink} style={styles.modalButton} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={Boolean(sourceChoiceTarget)} animationType="slide" transparent onRequestClose={() => setSourceChoiceTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modalCard, modalSafeAreaStyle]}>
            <Text style={styles.modalTitle}>Ajouter un son</Text>
            <Text style={styles.modalHint}>{sourceChoiceTarget?.title}</Text>
            <View style={styles.sourceChoiceActions}>
              <AppButton icon="file-audio" label="Son du mobile" tone="primary" onPress={chooseCategoryMobileSource} style={styles.modalButton} />
              <AppButton icon="external-link-alt" label="Son externe" onPress={chooseCategoryExternalSource} style={styles.modalButton} />
            </View>
            <AppButton label="Annuler" onPress={() => setSourceChoiceTarget(null)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={Boolean(youtubePlayer)} animationType="slide" onRequestClose={stopYoutubePlayer}>
        <View style={[styles.youtubeScreen, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.youtubeHeader}>
            <Text numberOfLines={1} style={styles.youtubeTitle}>{youtubePlayer?.title ?? "YouTube"}</Text>
            <AppButton compact icon="stop" label="Stop" tone="danger" onPress={stopYoutubePlayer} />
          </View>
          <View style={styles.youtubeFrame}>
            {youtubeVideoId ? (
              <WebView
                ref={youtubeWebViewRef}
                source={{ html: youtubePlayerHtml(youtubeVideoId), baseUrl: "https://jdrambiances.local" }}
                allowsFullscreenVideo
                javaScriptEnabled
                domStorageEnabled
                mediaPlaybackRequiresUserAction={false}
                originWhitelist={["*"]}
                style={styles.youtubeWebView}
              />
            ) : (
              <View style={styles.youtubeFallback}>
                <Text style={styles.modalHint}>Ce lien YouTube n'est pas reconnu.</Text>
                <AppButton label="Ouvrir le lien" icon="external-link-alt" tone="primary" onPress={() => youtubePlayer?.url && openExternalLink(youtubePlayer.url)} />
              </View>
            )}
          </View>
          {playableQuickEffects.length > 0 || visibleFolderQuickSounds.length > 0 ? (
            <View style={styles.youtubeQuickPanel}>
              <Text style={styles.youtubeQuickTitle}>Sons rapides</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.youtubeQuickList}>
                {playableQuickEffects.map((effect) => (
                  <Pressable
                    key={effect.id}
                    accessibilityRole="button"
                    onPress={() => playQuickEffect(effect.id)}
                    style={styles.youtubeQuickButton}
                  >
                    <FontAwesome5 name={effect.icon as never} size={20} color={effect.accent} />
                    <Text numberOfLines={2} style={styles.youtubeQuickText}>{effect.title}</Text>
                  </Pressable>
                ))}
                {visibleFolderQuickSounds.map((item) => {
                  const asset = customSoundAssets[item.id];
                  if (!asset && !item.externalLink) return null;

                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      onPress={() => playCustomQuickSound(item.id)}
                      style={styles.youtubeQuickButton}
                    >
                      <FontAwesome5 name={item.icon as never} size={20} color={item.accent} />
                      <Text numberOfLines={2} style={styles.youtubeQuickText}>{item.title}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>
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
  planRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10
  },
  planBadge: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontWeight: "900",
    letterSpacing: 0
  },
  planBadgePremium: {
    borderColor: colors.gold,
    color: colors.gold,
    backgroundColor: "#2b2419"
  },
  heroActions: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10
  },
  heroButton: {
    flex: 1
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 8
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
  planHint: {
    marginTop: 10,
    color: colors.muted,
    lineHeight: 18,
    fontWeight: "600"
  },
  folderRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  folderButton: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  folderButtonSelected: {
    borderColor: colors.gold,
    backgroundColor: "#2b2419"
  },
  folderName: {
    color: colors.text,
    fontWeight: "800",
    letterSpacing: 0
  },
  folderNameSelected: {
    color: colors.gold
  },
  customPanel: {
    marginTop: 12,
    gap: 12
  },
  customHeader: {
    gap: 10
  },
  customTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0
  },
  customActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  imageSection: {
    gap: 10
  },
  imageFolderCard: {
    minHeight: 78,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12
  },
  imageFolderIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: "#2b2419",
    alignItems: "center",
    justifyContent: "center"
  },
  imageFolderCopy: {
    flex: 1
  },
  imageFolderTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0
  },
  imageFolderMeta: {
    marginTop: 4,
    color: colors.muted,
    fontWeight: "700"
  },
  imageFolderContent: {
    gap: 10
  },
  imageSearchInput: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: 12,
    fontWeight: "800"
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  imageCard: {
    width: "48%",
    minHeight: 190,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden"
  },
  campaignImage: {
    width: "100%",
    height: 110,
    backgroundColor: colors.background
  },
  imageCopy: {
    paddingHorizontal: 10,
    paddingTop: 8,
    gap: 3
  },
  imageTitle: {
    color: colors.text,
    fontWeight: "900",
    letterSpacing: 0
  },
  imageMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  imageActions: {
    marginTop: "auto",
    flexDirection: "row",
    gap: 6,
    padding: 8
  },
  imagePreviewScreen: {
    flex: 1,
    backgroundColor: "#050505",
    alignItems: "center",
    justifyContent: "center",
    padding: 16
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  imagePreview: {
    width: "100%",
    height: "82%"
  },
  imagePreviewTitle: {
    marginTop: 14,
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0
  },
  ambientDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  ambientDetailIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  ambientDetailText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600"
  },
  sectionTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  sectionTab: {
    minHeight: 34,
    maxWidth: 160,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  sectionTabActive: {
    borderColor: colors.gold,
    backgroundColor: "#2b2419"
  },
  sectionTabText: {
    color: colors.muted,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0
  },
  sectionTabTextActive: {
    color: colors.gold
  },
  sessionSceneRow: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  customAmbientItem: {
    width: "48%",
    gap: 8,
    alignItems: "stretch"
  },
  fullWidthCard: {
    width: "100%"
  },
  customQuickItem: {
    width: "100%",
    padding: 4,
    alignItems: "flex-start"
  },
  itemActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    width: "100%"
  },
  quickItemActions: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 4,
    width: "25%"
  },
  itemActionButton: {
    width: "100%",
    minHeight: 40
  },
  iconOnlyAction: {
    flex: 1,
    minHeight: 34,
    paddingHorizontal: 0
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  iconChoice: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center"
  },
  iconChoiceSelected: {
    borderColor: colors.gold,
    backgroundColor: "#2b2419"
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  colorChoice: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border
  },
  colorChoiceSelected: {
    borderColor: colors.text
  },
  filePickerRow: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  filePickerCopy: {
    flex: 1
  },
  filePickerTitle: {
    color: colors.text,
    fontWeight: "900",
    letterSpacing: 0
  },
  filePickerName: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
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
  quickControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10
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
  tallModalCard: {
    maxHeight: "88%"
  },
  modalScroll: {
    gap: 12,
    paddingBottom: 8
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
  exportText: {
    minHeight: 220,
    paddingTop: 12,
    textAlignVertical: "top",
    fontSize: 12,
    fontWeight: "500"
  },
  modalHint: {
    color: colors.muted,
    lineHeight: 18
  },
  choiceGroup: {
    gap: 8
  },
  planCard: {
    minHeight: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  planCopy: {
    flex: 1
  },
  planTitle: {
    color: colors.text,
    fontWeight: "900",
    letterSpacing: 0
  },
  planText: {
    marginTop: 4,
    color: colors.muted,
    lineHeight: 17
  },
  accountEmail: {
    color: colors.gold,
    fontWeight: "900",
    letterSpacing: 0
  },
  authSwitch: {
    alignItems: "flex-start"
  },
  premiumList: {
    gap: 8
  },
  premiumItem: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    padding: 10,
    fontWeight: "800"
  },
  modalActions: {
    flexDirection: "row",
    gap: 10
  },
  sourceChoiceActions: {
    flexDirection: "row",
    gap: 10
  },
  modalButton: {
    flex: 1
  },
  youtubeScreen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 12
  },
  youtubeHeader: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  youtubeTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0
  },
  youtubeFrame: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.shadow,
    overflow: "hidden"
  },
  youtubeWebView: {
    flex: 1,
    backgroundColor: colors.shadow
  },
  youtubeFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 18
  },
  youtubeQuickPanel: {
    maxHeight: 136,
    paddingTop: 12,
    gap: 8
  },
  youtubeQuickTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0
  },
  youtubeQuickList: {
    gap: 10,
    paddingRight: 12
  },
  youtubeQuickButton: {
    width: 112,
    minHeight: 82,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 10
  },
  youtubeQuickText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0
  },
  
});
