import { MixerState } from "../types/audio";

export const defaultMixerState: MixerState = {
  ambient: 0.8,
  music: 0.65,
  sfx: 0.9,
  special: 0.75
};

export const trackLabels = {
  ambient: "Ambiance de fond",
  music: "Musique",
  sfx: "Bruitages ponctuels",
  special: "Effets spéciaux"
} as const;
