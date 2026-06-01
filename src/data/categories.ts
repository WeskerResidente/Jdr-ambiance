import { AmbientCategory, QuickEffect } from "../types/audio";

export const ambientCategories: AmbientCategory[] = [
  { id: "tavern", title: "Taverne", description: "Rires, chopes, feu de cheminee", icon: "beer", accent: "#d6a84f" },
  { id: "forest", title: "Foret", description: "Feuillage, vent, oiseaux lointains", icon: "tree", accent: "#6d9f7b" },
  { id: "dungeon", title: "Donjon", description: "Pierres humides et gouttes d'eau", icon: "dungeon", accent: "#87909d" },
  { id: "combat", title: "Combat", description: "Tension, tambours, acier", icon: "shield-alt", accent: "#b65b5b" },
  { id: "city", title: "Ville", description: "Marche, foule, artisans", icon: "city", accent: "#c18a58" },
  { id: "storm", title: "Pluie / Orage", description: "Averse, grondements, eclairs", icon: "bolt", accent: "#617fa8" },
  { id: "sea", title: "Mer", description: "Vagues, bois qui craque, mouettes", icon: "anchor", accent: "#5e9aa8" },
  { id: "mystery", title: "Mystere", description: "Nappes etranges, indices, secret", icon: "moon", accent: "#8a6bb8" },
  { id: "horror", title: "Horreur", description: "Drones graves, murmures, malaise", icon: "eye", accent: "#9a4f73" },
  { id: "camp", title: "Repos / Campement", description: "Feu, nuit calme, bivouac", icon: "fire", accent: "#d07a4d" }
];

export const quickEffects: QuickEffect[] = [
  { id: "door", title: "Porte qui grince", icon: "door-open", accent: "#d6a84f", bundledAudioKey: "door" },
  { id: "sword", title: "Epee", icon: "khanda", accent: "#bfc7d5", bundledAudioKey: "sword" },
  { id: "monster", title: "Cri de monstre", icon: "dragon", accent: "#b65b5b", bundledAudioKey: "monster" },
  { id: "magic", title: "Explosion magique", icon: "magic", accent: "#8a6bb8", bundledAudioKey: "magic" },
  { id: "thunder", title: "Tonnerre", icon: "bolt", accent: "#617fa8", bundledAudioKey: "thunder" },
  { id: "steps", title: "Pas", icon: "shoe-prints", accent: "#9c8770", bundledAudioKey: "steps" },
  { id: "chest", title: "Coffre", icon: "archive", accent: "#d6a84f", bundledAudioKey: "chest" },
  { id: "trap", title: "Piege", icon: "crosshairs", accent: "#b65b5b", bundledAudioKey: "trap" }
];
