import { create } from "zustand";
import type { PictionaryGameState, PictionaryGuess, PictionaryDifficultyLevel } from "../types";

interface PictionaryStoreActions {
  setPhase: (phase: PictionaryGameState["phase"]) => void;
  setCurrentRound: (round: number, team: string, drawerId: string) => void;
  setWord: (word: string | null, difficulty?: PictionaryDifficultyLevel | null, category?: string | null, pointValue?: number) => void;
  setCurrentPointValue: (points: number) => void;
  addGuess: (guess: PictionaryGuess) => void;
  clearGuesses: () => void;
  updateScores: (scores: Record<string, number>, teamScores: Record<string, number>) => void;
  setRoundWinner: (playerId: string | null) => void;
  addUsedWord: (word: string) => void;
  reset: () => void;
}

const initialState: PictionaryGameState = {
  phase: "waiting",
  currentRound: 0,
  totalRounds: 6,
  currentTeam: "",
  currentDrawerId: null,
  currentWord: null,
  currentWordCategory: null,
  currentWordDifficulty: null,
  currentPointValue: 100,
  guesses: [],
  scores: {},
  teamScores: {},
  roundWinner: null,
  usedWords: [],
};

export const usePictionaryStore = create<PictionaryGameState & PictionaryStoreActions>(
  (set) => ({
    ...initialState,

    setPhase: (phase) => set({ phase }),

    setCurrentRound: (round, team, drawerId) =>
      set({
        currentRound: round,
        currentTeam: team,
        currentDrawerId: drawerId,
        guesses: [],
        roundWinner: null,
        currentWord: null,
        currentWordCategory: null,
        currentWordDifficulty: null,
        currentPointValue: 100,
        phase: "round_start",
      }),

    setWord: (word, difficulty = null, category = null, pointValue = 100) =>
      set({
        currentWord: word,
        currentWordDifficulty: difficulty,
        currentWordCategory: category,
        currentPointValue: pointValue,
      }),

    setCurrentPointValue: (points) => set({ currentPointValue: points }),

    addGuess: (guess) =>
      set((state) => ({ guesses: [...state.guesses, guess] })),

    clearGuesses: () => set({ guesses: [] }),

    updateScores: (scores, teamScores) => set({ scores, teamScores }),

    setRoundWinner: (playerId) => set({ roundWinner: playerId }),

    addUsedWord: (word) =>
      set((state) => ({ usedWords: [...state.usedWords, word] })),

    reset: () => set(initialState),
  })
);
