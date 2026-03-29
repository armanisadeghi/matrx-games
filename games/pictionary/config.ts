import { Pencil } from "lucide-react";
import type { GameDefinition } from "@/games/types";
import { PictionaryGame } from "./components/PictionaryGame";
import { DEFAULT_SETTINGS } from "./constants";

export const pictionaryConfig: GameDefinition = {
  slug: "pictionary",
  name: "Pictionary Helper",
  description:
    "Take turns describing words to your team. The team that guesses the most words wins!",
  icon: Pencil,
  minPlayers: 4,
  maxPlayers: 20,
  supportsTeams: true,
  supportsSinglePlayer: false,
  defaultSettings: DEFAULT_SETTINGS,
  roles: ["drawer", "guesser"],
  teams: {
    count: 2,
    minPerTeam: 2,
    maxPerTeam: 10,
    names: ["Team A", "Team B"],
  },
  GameComponent: PictionaryGame,
};
