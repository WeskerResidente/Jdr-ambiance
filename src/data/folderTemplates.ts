export interface FolderTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  sections: string[];
}

export const folderTemplates: FolderTemplate[] = [
  {
    id: "empty",
    name: "Vide",
    description: "Créer un dossier personnalisé",
    icon: "folder",
    sections: []
  },
  {
    id: "dungeon",
    name: "Donjon",
    description: "Ambiances de grottes et dungeons",
    icon: "dungeon",
    sections: ["Exploration", "Combat", "Boss", "Ambient"]
  },
  {
    id: "forest",
    name: "Forêt",
    description: "Ambiances naturelles et forestières",
    icon: "tree",
    sections: ["Jour", "Nuit", "Tempête", "Faune", "Mystère"]
  },
  {
    id: "tavern",
    name: "Taverne",
    description: "Ambiances urbaines et sociales",
    icon: "beer",
    sections: ["Accueil", "Dialogue", "Musique", "Ambiance foule"]
  },
  {
    id: "boss_fight",
    name: "Combat Boss",
    description: "Musiques épiques et intensité",
    icon: "crown",
    sections: ["Préparation", "Phase 1", "Phase 2", "Victoire", "Défaite"]
  },
  {
    id: "city",
    name: "Ville",
    description: "Ambiances urbaines et marchés",
    icon: "gopuram",
    sections: ["Jour", "Nuit", "Marché", "Rues", "Tavernes"]
  },
  {
    id: "horror",
    name: "Horreur",
    description: "Ambiances sombres et menaçantes",
    icon: "skull",
    sections: ["Tension", "Apparition", "Poursuite", "Combat", "Mort"]
  },
  {
    id: "heaven",
    name: "Ciel/Paradis",
    description: "Ambiances célestes et magiques",
    icon: "cloud",
    sections: ["Magie", "Sanctuaire", "Voyage", "Batailles aériennes"]
  }
];
