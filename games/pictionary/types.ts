export type PictionaryPhase =
  | "waiting"
  | "round_start"
  | "picking_difficulty" // drawer chooses difficulty before word is revealed
  | "previewing" // 10s countdown while drawer memorises the word
  | "drawing"
  | "round_end"
  | "game_over";

export type PictionaryDifficultyLevel =
  | "easy"
  | "medium"
  | "hard"
  | "very_hard"
  | "extra_challenge";

export interface PictionaryGameState {
  phase: PictionaryPhase;
  currentRound: number;
  totalRounds: number;
  currentTeam: string;
  currentDrawerId: string | null;
  currentWord: string | null;
  currentWordCategory: string | null;
  currentWordDifficulty: PictionaryDifficultyLevel | null;
  currentPointValue: number;
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
  wordDifficulty: PictionaryDifficultyLevel | "any";
  wordCategories: string[];
}
