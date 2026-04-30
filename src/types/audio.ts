export type TrackType = "ambient" | "music" | "sfx" | "special";

export type ExternalProvider = "spotify" | "youtube" | "other";

export type AmbientCategory = {
  id: string;
  title: string;
  description: string;
  icon: string;
  accent: string;
};

export type QuickEffect = {
  id: string;
  title: string;
  icon: string;
  accent: string;
};

export type SoundAsset = {
  id: string;
  title: string;
  localUri: string;
  fileName?: string;
  categoryId?: string;
  quickEffectId?: string;
  track: TrackType;
  createdAt: string;
};

export type ExternalAudioLink = {
  id: string;
  title: string;
  url: string;
  provider: ExternalProvider;
  categoryId?: string;
  quickEffectId?: string;
  createdAt: string;
};

export type SceneSound = {
  soundId: string;
  volume: number;
  track: TrackType;
};

export type Scene = {
  id: string;
  name: string;
  description?: string;
  sounds: SceneSound[];
  favorite: boolean;
  externalLink?: string;
  externalProvider?: ExternalProvider;
  transitionMinutes?: number;
  createdAt: string;
};

export type MixerState = Record<TrackType, number>;

export type SpotifyTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  issuedAt: number;
};

export type SpotifyDevice = {
  id: string | null;
  is_active: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number | null;
  supports_volume: boolean;
};
