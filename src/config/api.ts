import { Platform } from "react-native";

function normalizeApiUrl(url?: string) {
  if (!url) return "";
  if (url === "/") return "";
  return url.replace(/\/+$/, "");
}

const configuredApiUrl = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);
const webFallbackApiUrl = Platform.OS === "web" ? "/api" : "";

export const API_URL = configuredApiUrl || webFallbackApiUrl;
