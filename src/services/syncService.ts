import { API_URL } from "../config/api";
import { CampaignImage, CustomSound, ExternalAudioLink, Scene, SoundAsset, SoundFolder } from "../types/audio";
import { storageService } from "./storageService";

export type SyncSnapshot = {
  sounds: SoundAsset[];
  soundFolders: SoundFolder[];
  customSounds: CustomSound[];
  campaignImages: CampaignImage[];
  externalLinks: ExternalAudioLink[];
  scenes: Scene[];
  favoriteCategoriesByFolder: Record<string, string[]>;
};

type PullResponse = {
  data: SyncSnapshot | null;
  updatedAt: string | null;
};

function requireApiUrl() {
  if (!API_URL) throw new Error("API non configuree.");
  return API_URL;
}

async function authHeaders() {
  const token = await storageService.getAuthToken();
  if (!token) throw new Error("Utilisateur non connecte.");

  return { Authorization: `Bearer ${token}` };
}

async function readApiError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string; message?: string };
    return payload.error ?? payload.message ?? "Synchronisation refusee.";
  } catch {
    return "Synchronisation refusee.";
  }
}

async function apiRequest<T>(path: string, init: RequestInit = {}) {
  let response: Response;

  try {
    response = await fetch(`${requireApiUrl()}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(await authHeaders()),
        ...(init.headers ?? {})
      }
    });
  } catch {
    throw new Error("Impossible de joindre le serveur de synchronisation.");
  }

  if (!response.ok) throw new Error(await readApiError(response));
  return (await response.json()) as T;
}

export function createSyncSnapshot(params: SyncSnapshot): SyncSnapshot {
  return {
    sounds: params.sounds,
    soundFolders: params.soundFolders,
    customSounds: params.customSounds,
    campaignImages: params.campaignImages,
    externalLinks: params.externalLinks,
    scenes: params.scenes,
    favoriteCategoriesByFolder: params.favoriteCategoriesByFolder
  };
}

export async function readLocalSyncSnapshot(): Promise<SyncSnapshot> {
  const [
    sounds,
    soundFolders,
    customSounds,
    campaignImages,
    externalLinks,
    scenes,
    favoriteCategoriesByFolder
  ] = await Promise.all([
    storageService.getSounds(),
    storageService.getSoundFolders(),
    storageService.getCustomSounds(),
    storageService.getCampaignImages(),
    storageService.getExternalAudioLinks(),
    storageService.getScenes(),
    storageService.getFavoriteCategoriesByFolder()
  ]);

  return createSyncSnapshot({ sounds, soundFolders, customSounds, campaignImages, externalLinks, scenes, favoriteCategoriesByFolder });
}

export async function saveLocalSyncSnapshot(snapshot: SyncSnapshot) {
  await Promise.all([
    storageService.saveSounds(snapshot.sounds ?? []),
    storageService.saveSoundFolders(snapshot.soundFolders ?? []),
    storageService.saveCustomSounds(snapshot.customSounds ?? []),
    storageService.saveCampaignImages(snapshot.campaignImages ?? []),
    storageService.saveExternalAudioLinks(snapshot.externalLinks ?? []),
    storageService.saveScenes(snapshot.scenes ?? []),
    storageService.saveFavoriteCategoriesByFolder(snapshot.favoriteCategoriesByFolder ?? {})
  ]);
}

export const syncService = {
  async pull() {
    return apiRequest<PullResponse>("/sync", { method: "GET" });
  },

  async push(snapshot: SyncSnapshot) {
    return apiRequest<{ ok: boolean; updatedAt: string }>("/sync", {
      method: "POST",
      body: JSON.stringify({ data: snapshot })
    });
  }
};
