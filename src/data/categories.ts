import { AmbientCategory, QuickEffect } from "../types/audio";

export const ambientCategories: AmbientCategory[] = [
  { id: "tavern", title: "Taverne", description: "Rires, chopes, feu de cheminée", icon: "beer", accent: "#d6a84f" },
  { id: "forest", title: "Forêt", description: "Feuillage, vent, oiseaux lointains", icon: "tree", accent: "#6d9f7b" },
  { id: "dungeon", title: "Donjon", description: "Pierres humides et gouttes d'eau", icon: "dungeon", accent: "#87909d" },
  { id: "combat", title: "Combat", description: "Tension, tambours, acier", icon: "shield-alt", accent: "#b65b5b" },
  { id: "city", title: "Ville", description: "Marché, foule, artisans", icon: "city", accent: "#c18a58" },
  { id: "storm", title: "Pluie / Orage", description: "Averse, grondements, éclairs", icon: "bolt", accent: "#617fa8" },
  { id: "sea", title: "Mer", description: "Vagues, bois qui craque, mouettes", icon: "anchor", accent: "#5e9aa8" },
  { id: "mystery", title: "Mystère", description: "Nappes étranges, indices, secret", icon: "moon", accent: "#8a6bb8" },
  { id: "horror", title: "Horreur", description: "Drones graves, murmures, malaise", icon: "eye", accent: "#9a4f73" },
  { id: "camp", title: "Repos / Campement", description: "Feu, nuit calme, bivouac", icon: "fire", accent: "#d07a4d" }
];

export const quickEffects: QuickEffect[] = [
  { id: "door", title: "Porte qui grince", icon: "door-open", accent: "#d6a84f" },
  { id: "sword", title: "Épée", icon: "khanda", accent: "#bfc7d5" },
  { id: "monster", title: "Cri de monstre", icon: "dragon", accent: "#b65b5b" },
  { id: "magic", title: "Explosion magique", icon: "magic", accent: "#8a6bb8" },
  { id: "thunder", title: "Tonnerre", icon: "bolt", accent: "#617fa8" },
  { id: "steps", title: "Pas", icon: "shoe-prints", accent: "#9c8770" },
  { id: "chest", title: "Coffre", icon: "archive", accent: "#d6a84f" },
  { id: "trap", title: "Piège", icon: "crosshairs", accent: "#b65b5b" }
];
