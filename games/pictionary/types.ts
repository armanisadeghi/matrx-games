export type PictionaryPhase =
  | "waiting"
  | "round_start"
  | "drawing"
  | "round_end"
  | "game_over";

export interface PictionaryGameState {
  phase: PictionaryPhase;
  currentRound: number;
  totalRounds: number;
  currentTeam: string;
  currentDrawerId: string | null;
  currentWord: string | null;
  guesses: PictionaryGuess[];
  scores: Record<string, number>;
  teamScores: Record<string, number>;
  roundWinner: string | null;
  usedWords: string[];
}

export interface PictionaryGuess {
  playerId: string;
  displayName: string;
  guess: string;
  isCorrect: boolean;
  timestamp: number;
}

export interface PictionarySettings {
  roundsPerTeam: number;
  timerDuration: number;
  wordDifficulty: "easy" | "medium" | "hard";
}
