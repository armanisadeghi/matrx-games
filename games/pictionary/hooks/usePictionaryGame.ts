"use client";

import { useCallback } from "react";
import { gameRealtime } from "@/lib/game-engine/GameRealtimeService";
import { usePictionaryStore } from "../state/pictionaryStore";
import { DEFAULT_SETTINGS } from "../constants";
import { usePictionaryWords } from "./usePictionaryWords";
import type { Player } from "@/games/types";
import type { PictionaryGuess, PictionarySettings } from "../types";

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

  const { pickWord, markWordUsed, resetSessionUsage } = usePictionaryWords({
    difficulty: settings.wordDifficulty,
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

      const currentIndex = teamPlayers.findIndex(
        (p) => p.id === currentDrawerId,
      );
      return teamPlayers[(currentIndex + 1) % teamPlayers.length];
    },
    [players],
  );

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

    const word = pickWord();

    store.setCurrentRound(nextRound, team, drawer.id);
    store.setWord(null); // Don't set locally yet, use broadcast
    store.setPhase("drawing");

    // Mark used in DB (fire and forget)
    markWordUsed(word);

    // Broadcast round start to everyone (without the word)
    gameRealtime.broadcastEvent(roomId, "round:start", {
      roundNumber: nextRound,
      teamId: team,
      drawerId: drawer.id,
    });

    // Broadcast the word (all clients receive, only drawer UI reads it)
    gameRealtime.broadcastEvent(roomId, "word:assigned", { word });
  }, [isHost, roomId, store, getTeams, getNextDrawer, pickWord, markWordUsed]);

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
        const newScores = { ...store.scores };
        newScores[guess.playerId] = (newScores[guess.playerId] ?? 0) + 100;

        const newTeamScores = { ...store.teamScores };
        const guesserTeam = players.find(
          (p) => p.id === guess.playerId,
        )?.teamId;
        if (guesserTeam) {
          newTeamScores[guesserTeam] = (newTeamScores[guesserTeam] ?? 0) + 100;
        }

        // Drawer also gets points
        if (store.currentDrawerId) {
          newScores[store.currentDrawerId] =
            (newScores[store.currentDrawerId] ?? 0) + 50;
        }

        store.updateScores(newScores, newTeamScores);
        store.setRoundWinner(guess.playerId);
        store.setPhase("round_end");

        gameRealtime.broadcastEvent(roomId, "round:end", {
          word: store.currentWord,
          winnerId: guess.playerId,
          scores: newScores,
          teamScores: newTeamScores,
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
    submitGuess,
    handleGuessResult,
    handleTimerComplete,
    nextRoundOrEnd,
    resetGame,
    getTeams,
  };
}
