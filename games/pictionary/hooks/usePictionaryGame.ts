"use client";

import { useCallback, useRef } from "react";
import { gameRealtime } from "@/lib/game-engine/GameRealtimeService";
import { usePictionaryStore } from "../state/pictionaryStore";
import { DEFAULT_SETTINGS } from "../constants";
import { usePictionaryWords } from "./usePictionaryWords";
import type { Player } from "@/games/types";
import type {
  PictionaryGuess,
  PictionarySettings,
  PictionaryDifficultyLevel,
} from "../types";

interface UsePictionaryGameOptions {
  roomId: string;
  isHost: boolean;
  player: Player;
  players: Player[];
  settings?: Partial<PictionarySettings>;
}

export function usePictionaryGame({
  roomId,
  isHost,
  player,
  players,
  settings: userSettings,
}: UsePictionaryGameOptions) {
  const store = usePictionaryStore();

  // Guards against double round:end (correct guess races timer expiry)
  const roundEndedRef = useRef(false);

  const settings: PictionarySettings = {
    ...DEFAULT_SETTINGS,
    ...userSettings,
  };

  const { pickWordByDifficulty, markWordUsed, resetSessionUsage } =
    usePictionaryWords({
      difficulty: settings.wordDifficulty,
      categories: settings.wordCategories,
    });

  const getTeams = useCallback(() => {
    const teams = new Set(players.map((p) => p.teamId).filter(Boolean));
    return Array.from(teams) as string[];
  }, [players]);

  const getNextDrawer = useCallback(
    (teamId: string, currentDrawerId: string | null) => {
      const teamPlayers = players.filter((p) => p.teamId === teamId);
      if (teamPlayers.length === 0) return null;
      if (!currentDrawerId) {
        // Round 1: pick a random player from the team
        return teamPlayers[Math.floor(Math.random() * teamPlayers.length)];
      }
      const currentIndex = teamPlayers.findIndex(
        (p) => p.id === currentDrawerId,
      );
      return teamPlayers[(currentIndex + 1) % teamPlayers.length];
    },
    [players],
  );

  const startRound = useCallback(
    (skipDrawerId?: string) => {
      if (!isHost) return;

      const teams = getTeams();
      if (teams.length < 2) return;

      roundEndedRef.current = false;

      const nextRound = skipDrawerId
        ? store.currentRound
        : store.currentRound + 1;
      const teamIndex = (nextRound - 1) % teams.length;
      const team = teams[teamIndex];

      // When skipping, advance from the skipped drawer; otherwise normal rotation
      const drawerToAdvanceFrom =
        skipDrawerId ??
        (store.currentTeam === team ? store.currentDrawerId : null);
      const drawer = getNextDrawer(team, drawerToAdvanceFrom);
      if (!drawer) return;

      store.setCurrentRound(nextRound, team, drawer.id);
      store.setPhase("picking_difficulty");

      gameRealtime.broadcastEvent(roomId, "round:picking", {
        roundNumber: nextRound,
        teamId: team,
        drawerId: drawer.id,
      });
    },
    [isHost, roomId, store, getTeams, getNextDrawer],
  );

  const skipDrawer = useCallback(() => {
    if (!isHost) return;
    startRound(store.currentDrawerId ?? undefined);
  }, [isHost, store, startRound]);

  // Called by the drawer once they've chosen a difficulty
  const confirmDifficulty = useCallback(
    (chosenDifficulty: PictionaryDifficultyLevel) => {
      if (player.id !== store.currentDrawerId) return;

      roundEndedRef.current = false;

      const picked = pickWordByDifficulty(chosenDifficulty);
      markWordUsed(picked.word);

      store.setWord(
        picked.word,
        picked.difficulty,
        picked.category,
        picked.pointValue,
      );
      store.setPhase("previewing");

      gameRealtime.broadcastEvent(roomId, "word:preview", {
        word: picked.word,
        difficulty: picked.difficulty,
        category: picked.category,
        pointValue: picked.pointValue,
      });
    },
    [player.id, store, roomId, pickWordByDifficulty, markWordUsed],
  );

  // Called when preview countdown ends — transitions everyone to drawing
  const startDrawing = useCallback(() => {
    store.setPhase("drawing");
    gameRealtime.broadcastEvent(roomId, "round:start", {});
  }, [store, roomId]);

  const submitGuess = useCallback(
    (guessText: string) => {
      gameRealtime.broadcastEvent(roomId, "guess:submit", {
        playerId: player.id,
        displayName: player.displayName,
        guess: guessText,
      });
    },
    [roomId, player.id, player.displayName],
  );

  const handleGuessResult = useCallback(
    (guess: PictionaryGuess) => {
      store.addGuess(guess);

      if (guess.isCorrect && isHost) {
        // Guard: if round already ended (e.g. timer fired at the same moment), ignore
        if (roundEndedRef.current) return;
        roundEndedRef.current = true;

        const pointValue = store.currentPointValue;
        const newScores = { ...store.scores };
        newScores[guess.playerId] =
          (newScores[guess.playerId] ?? 0) + pointValue;

        const newTeamScores = { ...store.teamScores };
        const guesserTeam = players.find(
          (p) => p.id === guess.playerId,
        )?.teamId;
        if (guesserTeam) {
          newTeamScores[guesserTeam] =
            (newTeamScores[guesserTeam] ?? 0) + pointValue;
        }

        // Drawer gets half points for a successful round
        if (store.currentDrawerId) {
          const drawerPoints = Math.ceil(pointValue / 2);
          newScores[store.currentDrawerId] =
            (newScores[store.currentDrawerId] ?? 0) + drawerPoints;
        }

        store.updateScores(newScores, newTeamScores);
        store.setRoundWinner(guess.playerId);
        store.setPhase("round_end");

        gameRealtime.broadcastEvent(roomId, "round:end", {
          word: store.currentWord,
          winnerId: guess.playerId,
          scores: newScores,
          teamScores: newTeamScores,
          pointValue,
        });
      }
    },
    [isHost, roomId, store, players],
  );

  const handleTimerComplete = useCallback(() => {
    if (!isHost) return;
    // Guard: if a correct guess already ended the round, don't overwrite the winner
    if (roundEndedRef.current) return;
    roundEndedRef.current = true;

    store.setPhase("round_end");
    store.setRoundWinner(null);

    gameRealtime.broadcastEvent(roomId, "round:end", {
      word: store.currentWord,
      winnerId: null,
      scores: store.scores,
      teamScores: store.teamScores,
      pointValue: store.currentPointValue,
    });
  }, [isHost, roomId, store]);

  const nextRoundOrEnd = useCallback(() => {
    if (!isHost) return;

    const totalRounds = settings.roundsPerTeam * getTeams().length;
    if (store.currentRound >= totalRounds) {
      store.setPhase("game_over");
      gameRealtime.broadcastEvent(roomId, "game:end", {
        scores: store.scores,
        teamScores: store.teamScores,
      });
    } else {
      startRound();
    }
  }, [isHost, roomId, store, settings.roundsPerTeam, getTeams, startRound]);

  const resetGame = useCallback(() => {
    roundEndedRef.current = false;
    store.reset();
    resetSessionUsage();
    gameRealtime.broadcastEvent(roomId, "game:state", { action: "reset" });
  }, [roomId, store, resetSessionUsage]);

  return {
    ...store,
    settings,
    startRound,
    skipDrawer,
    confirmDifficulty,
    startDrawing,
    submitGuess,
    handleGuessResult,
    handleTimerComplete,
    nextRoundOrEnd,
    resetGame,
    getTeams,
  };
}
