import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import { CampaignImage, SoundAsset, TrackType } from "../types/audio";

const supportedMimeTypes = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg"];
const supportedImageMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export type PickedAudioFile = {
  uri: string;
  name?: string;
};

function extensionFromName(fileName: string): string {
  const match = fileName.match(/\.[a-z0-9]+$/i);
  return match?.[0] ?? ".mp3";
}

function imageExtensionFromName(fileName: string): string {
  const match = fileName.match(/\.[a-z0-9]+$/i);
  return match?.[0] ?? ".jpg";
}

export async function importAudioFile(params: {
  title: string;
  track: TrackType;
  categoryId?: string;
  quickEffectId?: string;
  folderId?: string;
  customSoundId?: string;
}): Promise<SoundAsset | null> {
  const picked = await pickAudioFile();
  if (!picked) return null;

  return savePickedAudioFile(picked, params);
}

export async function pickAudioFile(): Promise<PickedAudioFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: supportedMimeTypes,
    copyToCacheDirectory: true,
    multiple: false
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  return result.assets[0];
}

export async function savePickedAudioFile(
  picked: PickedAudioFile,
  params: {
    title: string;
    track: TrackType;
    categoryId?: string;
    quickEffectId?: string;
    folderId?: string;
    customSoundId?: string;
  }
): Promise<SoundAsset> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const safeName = `${id}${extensionFromName(picked.name ?? "sound.mp3")}`;
  const audioDirectory = new Directory(Paths.document, "audio");
  audioDirectory.create({ intermediates: true, idempotent: true });

  const source = new File(picked.uri);
  const destination = new File(audioDirectory, safeName);
  source.copy(destination);

  return {
    id,
    title: params.title,
    localUri: destination.uri,
    fileName: picked.name,
    categoryId: params.categoryId,
    quickEffectId: params.quickEffectId,
    folderId: params.folderId,
    customSoundId: params.customSoundId,
    track: params.track,
    createdAt: new Date().toISOString()
  };
}

export async function importCampaignImageFile(folderId: string): Promise<CampaignImage | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: supportedImageMimeTypes,
    copyToCacheDirectory: true,
    multiple: false
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const picked = result.assets[0];
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const safeName = `${id}${imageExtensionFromName(picked.name ?? "image.jpg")}`;
  const imageDirectory = new Directory(Paths.document, "campaign-images");
  imageDirectory.create({ intermediates: true, idempotent: true });

  const source = new File(picked.uri);
  const destination = new File(imageDirectory, safeName);
  source.copy(destination);

  return {
    id,
    folderId,
    title: picked.name ?? "Image",
    uri: destination.uri,
    source: "local",
    fileName: picked.name,
    createdAt: new Date().toISOString()
  };
}
