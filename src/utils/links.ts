import * as Linking from "expo-linking";
import { ExternalProvider } from "../types/audio";

export function detectExternalProvider(url: string): ExternalProvider {
  const lowered = url.toLowerCase();
  if (lowered.includes("spotify.com")) return "spotify";
  if (lowered.includes("youtube.com") || lowered.includes("youtu.be")) return "youtube";
  return "other";
}

export function externalButtonLabel(provider?: ExternalProvider) {
  if (provider === "spotify") return "Ouvrir dans Spotify";
  if (provider === "youtube") return "Ouvrir dans YouTube";
  return "Ouvrir le lien";
}

export async function openExternalLink(url?: string) {
  if (!url) return;
  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
  }
}
