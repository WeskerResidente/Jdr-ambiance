import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import { SoundAsset, TrackType } from "../types/audio";

const supportedMimeTypes = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg"];

function extensionFromName(fileName: string): string {
  const match = fileName.match(/\.[a-z0-9]+$/i);
  return match?.[0] ?? ".mp3";
}

export async function importAudioFile(params: {
  title: string;
  track: TrackType;
  categoryId?: string;
  quickEffectId?: string;
}): Promise<SoundAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: supportedMimeTypes,
    copyToCacheDirectory: true,
    multiple: false
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const picked = result.assets[0];
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
    track: params.track,
    createdAt: new Date().toISOString()
  };
}
