export type TrackType = "ambient" | "music" | "sfx" | "special";

export type ExternalProvider = "spotify" | "youtube" | "youtubeMusic" | "other";

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
  bundledAudioKey?: string;
};

export type SoundAsset = {
  id: string;
  title: string;
  localUri?: string;
  bundledAudioKey?: string;
  fileName?: string;
  categoryId?: string;
  quickEffectId?: string;
  folderId?: string;
  customSoundId?: string;
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
  folderId?: string;
  name: string;
  description?: string;
  sounds: SceneSound[];
  favorite: boolean;
  externalLink?: string;
  externalProvider?: ExternalProvider;
  transitionMinutes?: number;
  createdAt: string;
};

export type SoundFolder = {
  id: string;
  name: string;
  icon: string;
  accent: string;
  sections?: string[];
  createdAt: string;
};

export type CampaignImage = {
  id: string;
  folderId: string;
  title: string;
  uri: string;
  source: "local" | "link";
  fileName?: string;
  createdAt: string;
};

export type CustomSoundKind = "ambient" | "quick";

export type SubscriptionTier = "free" | "premium";

export type SubscriptionActivation = {
  tier: SubscriptionTier;
  premiumSince?: string;
};

export type LocalUser = {
  id?: string;
  email: string;
  createdAt: string;
};

export type CustomSound = {
  id: string;
  folderId: string;
  title: string;
  icon: string;
  accent: string;
  kind: CustomSoundKind;
  track: TrackType;
  section?: string;
  externalLink?: string;
  externalProvider?: ExternalProvider;
  sortOrder?: number;
  createdAt: string;
};

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
};
