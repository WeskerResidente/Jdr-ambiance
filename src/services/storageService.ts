import AsyncStorage from "@react-native-async-storage/async-storage";
import { CampaignImage, CustomSound, ExternalAudioLink, LocalUser, Scene, SoundAsset, SoundFolder, SpotifyTokens, SubscriptionTier } from "../types/audio";

const SOUND_KEY = "jdr.sounds";
const EXTERNAL_LINK_KEY = "jdr.externalAudioLinks";
const FOLDER_KEY = "jdr.soundFolders";
const CUSTOM_SOUND_KEY = "jdr.customSounds";
const CAMPAIGN_IMAGE_KEY = "jdr.campaignImages";
const SCENE_KEY = "jdr.scenes";
const FAVORITE_CATEGORIES_BY_FOLDER_KEY = "jdr.favoriteCategoriesByFolder";
const SPOTIFY_CLIENT_ID_KEY = "jdr.spotify.clientId";
const SPOTIFY_TOKENS_KEY = "jdr.spotify.tokens";
const SPOTIFY_DEVICE_ID_KEY = "jdr.spotify.deviceId";
const SUBSCRIPTION_TIER_KEY = "jdr.subscriptionTier";
const PREMIUM_SINCE_KEY = "jdr.premiumSince";
const LOCAL_USER_KEY = "jdr.localUser";
const AUTH_TOKEN_KEY = "jdr.auth.token";

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

const USER_DATA_KEYS = [
  SOUND_KEY,
  EXTERNAL_LINK_KEY,
  FOLDER_KEY,
  CUSTOM_SOUND_KEY,
  CAMPAIGN_IMAGE_KEY,
  SCENE_KEY,
  FAVORITE_CATEGORIES_BY_FOLDER_KEY
];

export const storageService = {
  getSounds: () => readJson<SoundAsset[]>(SOUND_KEY, []),
  saveSounds: (sounds: SoundAsset[]) => writeJson(SOUND_KEY, sounds),

  getExternalAudioLinks: () => readJson<ExternalAudioLink[]>(EXTERNAL_LINK_KEY, []),
  saveExternalAudioLinks: (links: ExternalAudioLink[]) => writeJson(EXTERNAL_LINK_KEY, links),

  getSoundFolders: () => readJson<SoundFolder[]>(FOLDER_KEY, []),
  saveSoundFolders: (folders: SoundFolder[]) => writeJson(FOLDER_KEY, folders),

  getCustomSounds: () => readJson<CustomSound[]>(CUSTOM_SOUND_KEY, []),
  saveCustomSounds: (customSounds: CustomSound[]) => writeJson(CUSTOM_SOUND_KEY, customSounds),

  getCampaignImages: () => readJson<CampaignImage[]>(CAMPAIGN_IMAGE_KEY, []),
  saveCampaignImages: (images: CampaignImage[]) => writeJson(CAMPAIGN_IMAGE_KEY, images),

  getScenes: () => readJson<Scene[]>(SCENE_KEY, []),
  saveScenes: (scenes: Scene[]) => writeJson(SCENE_KEY, scenes),

  getFavoriteCategoriesByFolder: () => readJson<Record<string, string[]>>(FAVORITE_CATEGORIES_BY_FOLDER_KEY, {}),
  saveFavoriteCategoriesByFolder: (categoriesByFolder: Record<string, string[]>) => writeJson(FAVORITE_CATEGORIES_BY_FOLDER_KEY, categoriesByFolder),

  getSpotifyClientId: () => readJson<string>(SPOTIFY_CLIENT_ID_KEY, ""),
  saveSpotifyClientId: (clientId: string) => writeJson(SPOTIFY_CLIENT_ID_KEY, clientId),

  getSpotifyTokens: () => readJson<SpotifyTokens | null>(SPOTIFY_TOKENS_KEY, null),
  saveSpotifyTokens: (tokens: SpotifyTokens | null) => writeJson(SPOTIFY_TOKENS_KEY, tokens),

  getSpotifyDeviceId: () => readJson<string>(SPOTIFY_DEVICE_ID_KEY, ""),
  saveSpotifyDeviceId: (deviceId: string) => writeJson(SPOTIFY_DEVICE_ID_KEY, deviceId),

  getSubscriptionTier: () => readJson<SubscriptionTier>(SUBSCRIPTION_TIER_KEY, "free"),
  saveSubscriptionTier: (tier: SubscriptionTier) => writeJson(SUBSCRIPTION_TIER_KEY, tier),

  getPremiumSince: () => readJson<string | null>(PREMIUM_SINCE_KEY, null),
  savePremiumSince: (premiumSince: string | null) => writeJson(PREMIUM_SINCE_KEY, premiumSince),

  getLocalUser: () => readJson<LocalUser | null>(LOCAL_USER_KEY, null),
  saveLocalUser: (user: LocalUser | null) => writeJson(LOCAL_USER_KEY, user),

  getAuthToken: () => readJson<string | null>(AUTH_TOKEN_KEY, null),
  saveAuthToken: (token: string | null) => writeJson(AUTH_TOKEN_KEY, token),

  clearUserData: () => AsyncStorage.multiRemove(USER_DATA_KEYS)
};
