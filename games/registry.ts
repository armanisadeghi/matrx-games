import type { GameDefinition } from "./types";
import { pictionaryConfig } from "./pictionary/config";

const games: GameDefinition[] = [pictionaryConfig];

const gameMap = new Map<string, GameDefinition>(
  games.map((g) => [g.slug, g])
);

export function getGame(slug: string): GameDefinition | undefined {
  return gameMap.get(slug);
}

export function getAllGames(): GameDefinition[] {
  return games;
}

export { games };
