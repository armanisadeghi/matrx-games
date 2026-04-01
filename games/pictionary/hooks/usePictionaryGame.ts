"use client";

import { useCallback } from "react";
import { gameRealtime } from "@/lib/game-engine/GameRealtimeService";
import { usePictionaryStore } from "../state/pictionaryStore";
import { DEFAULT_SETTINGS } from "../constants";
import { usePictionaryWords } from "./usePictionaryWords";
import type { Player } from "@/games/types";
import type { PictionaryGuess, PictionarySettings, PictionaryDifficultyLevel } from "../types";

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

  const settings: PictionarySettings = {
    ...DEFAULT_SETTINGS,
    ...userSettings,
  };

  const { pickWordByDifficulty, markWordUsed, resetSessionUsage } = usePictionaryWords({
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
      if (!currentDrawerId) return teamPlayers[0];
      const currentIndex = teamPlayers.findIndex((p) => p.id === currentDrawerId);
      return teamPlayers[(currentIndex + 1) % teamPlayers.length];
    },
    [players],
  );

  // Host calls this to start a round — moves to picking_difficulty so the drawer
  // can choose their difficulty before the word is revealed
  const startRound = useCallback(() => {
    if (!isHost) return;

    const teams = getTeams();
    if (teams.length < 2) return;

    const nextRound = store.currentRound + 1;
    const teamIndex = (nextRound - 1) % teams.length;
    const team = teams[teamIndex];
    const drawer = getNextDrawer(
      team,
      store.currentTeam === team ? store.currentDrawerId : null,
    );
    if (!drawer) return;

    store.setCurrentRound(nextRound, team, drawer.id);
    store.setPhase("picking_difficulty");

    gameRealtime.broadcastEvent(roomId, "round:picking", {
      roundNumber: nextRound,
      teamId: team,
      drawerId: drawer.id,
    });
  }, [isHost, roomId, store, getTeams, getNextDrawer]);

  // Called by the drawer once they've chosen a difficulty
  const confirmDifficulty = useCallback(
    (chosenDifficulty: PictionaryDifficultyLevel) => {
      if (player.id !== store.currentDrawerId) return;

      const picked = pickWordByDifficulty(chosenDifficulty);
      markWordUsed(picked.word);

      store.setWord(picked.word, picked.difficulty, picked.category, picked.pointValue);
      store.setPhase("drawing");

      // Broadcast word to all clients (only drawer UI renders it)
      gameRealtime.broadcastEvent(roomId, "word:assigned", {
        word: picked.word,
        difficulty: picked.difficulty,
        category: picked.category,
        pointValue: picked.pointValue,
      });
    },
    [player.id, store, roomId, pickWordByDifficulty, markWordUsed],
  );

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
        const pointValue = store.currentPointValue;
        const newScores = { ...store.scores };
        newScores[guess.playerId] = (newScores[guess.playerId] ?? 0) + pointValue;

        const newTeamScores = { ...store.teamScores };
        const guesserTeam = players.find((p) => p.id === guess.playerId)?.teamId;
        if (guesserTeam) {
          newTeamScores[guesserTeam] = (newTeamScores[guesserTeam] ?? 0) + pointValue;
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
    store.reset();
    resetSessionUsage();
    if (isHost) {
      gameRealtime.broadcastEvent(roomId, "game:state", { action: "reset" });
    }
  }, [isHost, roomId, store, resetSessionUsage]);

  return {
    ...store,
    settings,
    startRound,
    confirmDifficulty,
    submitGuess,
    handleGuessResult,
    handleTimerComplete,
    nextRoundOrEnd,
    resetGame,
    getTeams,
  };
}
