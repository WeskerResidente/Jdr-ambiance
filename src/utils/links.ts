import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { ExternalProvider } from "../types/audio";

export function detectExternalProvider(url: string): ExternalProvider {
  const lowered = url.toLowerCase();
  if (lowered.includes("spotify.com")) return "spotify";
  if (lowered.includes("music.youtube.com")) return "youtubeMusic";
  if (lowered.includes("youtube.com") || lowered.includes("youtu.be")) return "youtube";
  return "other";
}

export function isYoutubeUrl(url: string) {
  const lowered = url.toLowerCase();
  return lowered.includes("youtube.com") || lowered.includes("youtu.be");
}

export function youtubeVideoIdFromUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  try {
    const parsedUrl = new URL(trimmed);
    const host = parsedUrl.hostname.replace(/^www\./i, "").toLowerCase();

    if (host === "youtu.be") return parsedUrl.pathname.split("/").filter(Boolean)[0];
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (parsedUrl.pathname.startsWith("/watch")) return parsedUrl.searchParams.get("v") ?? undefined;
      if (parsedUrl.pathname.startsWith("/shorts/") || parsedUrl.pathname.startsWith("/embed/")) {
        return parsedUrl.pathname.split("/").filter(Boolean)[1];
      }
    }
  } catch {
    const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{6,})/);
    return match?.[1];
  }

  return undefined;
}

export function externalButtonLabel(provider?: ExternalProvider) {
  if (provider === "spotify") return "Lecture";
  if (provider === "youtube") return "Lecture";
  if (provider === "youtubeMusic") return "Lecture";
  return "Ouvrir le lien";
}

function youtubeMusicAndroidUrls(url: string) {
  const webUrl = url.trim();
  const withoutProtocol = webUrl.replace(/^https?:\/\//i, "");
  const encodedFallback = encodeURIComponent(webUrl);

  return [
    webUrl.replace(/^https?:\/\//i, "vnd.youtube.music://"),
    `intent://${withoutProtocol}#Intent;scheme=https;package=com.google.android.apps.youtube.music;S.browser_fallback_url=${encodedFallback};end`,
    webUrl
  ];
}

export async function openExternalLink(url?: string) {
  if (!url) return;

  if (detectExternalProvider(url) === "youtubeMusic" && Platform.OS === "android") {
    for (const candidateUrl of youtubeMusicAndroidUrls(url)) {
      try {
        await Linking.openURL(candidateUrl);
        return;
      } catch {
        // Try the next format, then fall back to the original web URL.
      }
    }
  }

  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  } catch {
    await Linking.openURL(url);
  }
}
