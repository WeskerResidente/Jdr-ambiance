// Public OAuth client ID for your Spotify Developer application.
// This is not a secret. The fallback keeps Spotify enabled in EAS/native builds
// even when EXPO_PUBLIC_SPOTIFY_CLIENT_ID was not injected during build.
const defaultSpotifyClientId = "bc0f0143a58c46e5842f8f65ae707334";

export const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID?.trim() || defaultSpotifyClientId;
// exp://192.168.1.84:8084/--/spotify-auth
// exp://192.168.1.84:8081/--/spotify-auth A RAJOUTER DANS https://developer.spotify.com/dashboard/bc0f0143a58c46e5842f8f65ae707334
