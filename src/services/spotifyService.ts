import { SpotifyDevice, SpotifyTokens } from "../types/audio";

const apiBaseUrl = "https://api.spotify.com/v1";

export function spotifyUriFromUrl(url: string): string | undefined {
  const trimmed = url.trim();
  if (trimmed.startsWith("spotify:")) return trimmed;

  const match = trimmed.match(/open\.spotify\.com\/(playlist|album|track|artist)\/([a-zA-Z0-9]+)/);
  if (!match) return undefined;

  return `spotify:${match[1]}:${match[2]}`;
}

export function isSpotifyTokenFresh(tokens: SpotifyTokens | null) {
  if (!tokens?.expiresIn) return Boolean(tokens?.accessToken);
  const expiresAt = tokens.issuedAt + tokens.expiresIn;
  const now = Math.floor(Date.now() / 1000);
  return expiresAt - now > 90;
}

async function spotifyRequest(accessToken: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  if (!response.ok && response.status !== 204) {
    const body = await response.text();
    throw new Error(body || `Spotify API error ${response.status}`);
  }

  return response;
}

export async function getSpotifyDevices(accessToken: string): Promise<SpotifyDevice[]> {
  const response = await spotifyRequest(accessToken, "/me/player/devices");
  const body = (await response.json()) as { devices: SpotifyDevice[] };
  return body.devices.filter((device) => device.id && !device.is_restricted);
}

export async function getSpotifyPlayback(accessToken: string): Promise<{ is_playing: boolean; device?: SpotifyDevice } | null> {
  const response = await spotifyRequest(accessToken, "/me/player");
  if (response.status === 204) return null;
  return (await response.json()) as { is_playing: boolean; device?: SpotifyDevice };
}

export async function transferSpotifyPlayback(accessToken: string, deviceId: string, play = false) {
  await spotifyRequest(accessToken, "/me/player", {
    method: "PUT",
    body: JSON.stringify({
      device_ids: [deviceId],
      play
    })
  });
}

export async function pauseSpotifyPlayback(accessToken: string, deviceId?: string) {
  const target = deviceId ? `/me/player/pause?device_id=${encodeURIComponent(deviceId)}` : "/me/player/pause";
  await spotifyRequest(accessToken, target, {
    method: "PUT"
  });
}

export async function pauseSpotifyPlaybackEverywhere(accessToken: string, deviceIds: string[]) {
  const uniqueDeviceIds = Array.from(new Set(deviceIds.filter(Boolean)));
  const attempts = [() => pauseSpotifyPlayback(accessToken), ...uniqueDeviceIds.map((deviceId) => () => pauseSpotifyPlayback(accessToken, deviceId))];
  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      await attempt();
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export async function forceStopSpotifyPlayback(accessToken: string, preferredDeviceIds: string[] = []) {
  const deviceIds = new Set(preferredDeviceIds.filter(Boolean));

  try {
    const playback = await getSpotifyPlayback(accessToken);
    if (playback?.device?.id && !playback.device.is_restricted) {
      deviceIds.add(playback.device.id);
    }
  } catch {
    // The plain pause and device fallback below can still succeed.
  }

  try {
    const devices = await getSpotifyDevices(accessToken);
    devices.forEach((device) => {
      if (device.id) deviceIds.add(device.id);
    });
  } catch {
    // Device listing is optional for the stop command.
  }

  await pauseSpotifyPlaybackEverywhere(accessToken, Array.from(deviceIds));

  await Promise.allSettled(
    Array.from(deviceIds).map(async (deviceId) => {
      await transferSpotifyPlayback(accessToken, deviceId, false);
      await pauseSpotifyPlayback(accessToken, deviceId);
    })
  );
}

export async function startSpotifyPlayback(accessToken: string, spotifyUri: string, deviceId?: string) {
  const body = spotifyUri.startsWith("spotify:track:")
    ? { uris: [spotifyUri] }
    : { context_uri: spotifyUri };

  const target = deviceId ? `/me/player/play?device_id=${encodeURIComponent(deviceId)}` : "/me/player/play";
  await spotifyRequest(accessToken, target, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export async function getSpotifyProfile(accessToken: string): Promise<{ display_name?: string; id: string }> {
  const response = await spotifyRequest(accessToken, "/me");
  return (await response.json()) as { display_name?: string; id: string };
}
