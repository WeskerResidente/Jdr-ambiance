import AsyncStorage from "@react-native-async-storage/async-storage";
import { ExternalAudioLink, MixerState, Scene, SoundAsset, SpotifyTokens } from "../types/audio";
import { defaultMixerState } from "../data/mixer";

const SOUND_KEY = "jdr.sounds";
const EXTERNAL_LINK_KEY = "jdr.externalAudioLinks";
const SCENE_KEY = "jdr.scenes";
const MIXER_KEY = "jdr.mixer";
const FAVORITE_CATEGORY_KEY = "jdr.favoriteCategories";
const SPOTIFY_CLIENT_ID_KEY = "jdr.spotify.clientId";
const SPOTIFY_TOKENS_KEY = "jdr.spotify.tokens";
const SPOTIFY_DEVICE_ID_KEY = "jdr.spotify.deviceId";

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

export const storageService = {
  getSounds: () => readJson<SoundAsset[]>(SOUND_KEY, []),
  saveSounds: (sounds: SoundAsset[]) => writeJson(SOUND_KEY, sounds),

  getExternalAudioLinks: () => readJson<ExternalAudioLink[]>(EXTERNAL_LINK_KEY, []),
  saveExternalAudioLinks: (links: ExternalAudioLink[]) => writeJson(EXTERNAL_LINK_KEY, links),

  getScenes: () => readJson<Scene[]>(SCENE_KEY, []),
  saveScenes: (scenes: Scene[]) => writeJson(SCENE_KEY, scenes),

  getMixer: () => readJson<MixerState>(MIXER_KEY, defaultMixerState),
  saveMixer: (mixer: MixerState) => writeJson(MIXER_KEY, mixer),

  getFavoriteCategories: () => readJson<string[]>(FAVORITE_CATEGORY_KEY, []),
  saveFavoriteCategories: (ids: string[]) => writeJson(FAVORITE_CATEGORY_KEY, ids),

  getSpotifyClientId: () => readJson<string>(SPOTIFY_CLIENT_ID_KEY, ""),
  saveSpotifyClientId: (clientId: string) => writeJson(SPOTIFY_CLIENT_ID_KEY, clientId),

  getSpotifyTokens: () => readJson<SpotifyTokens | null>(SPOTIFY_TOKENS_KEY, null),
  saveSpotifyTokens: (tokens: SpotifyTokens | null) => writeJson(SPOTIFY_TOKENS_KEY, tokens),

  getSpotifyDeviceId: () => readJson<string>(SPOTIFY_DEVICE_ID_KEY, ""),
  saveSpotifyDeviceId: (deviceId: string) => writeJson(SPOTIFY_DEVICE_ID_KEY, deviceId)
};
