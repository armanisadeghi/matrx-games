"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import type { GameComponentProps } from "@/games/types";
import { usePictionaryGame } from "../hooks/usePictionaryGame";
import { usePictionaryRealtime } from "../hooks/usePictionaryRealtime";
import { useSyncedTimer } from "@/features/timer/hooks/useSyncedTimer";
import { DrawerView } from "./DrawerView";
import { GuesserView } from "./GuesserView";
import { SpectatorView } from "./SpectatorView";
import { RoundResults } from "./RoundResults";
import { GameOverScreen } from "./GameOverScreen";
import type { PictionarySettings } from "../types";

export function PictionaryGame({
  room,
  player,
  players,
  isHost,
}: GameComponentProps) {
  const game = usePictionaryGame({
    roomId: room.id,
    isHost,
    player,
    players,
    settings: room.settings as Partial<PictionarySettings>,
  });

  const { timer, start: startTimer } = useSyncedTimer({
    roomId: room.id,
    isHost,
    duration: game.settings.timerDuration,
    onComplete: game.handleTimerComplete,
  });

  // Host validates guesses
  const onGuessReceived = useCallback(
    (data: { playerId: string; displayName: string; guess: string }) => {
      if (!isHost || !game.currentWord) return;

      const isCorrect =
        data.guess.toLowerCase().trim() ===
        game.currentWord.toLowerCase().trim();

      // Broadcast result to everyone
      game.handleGuessResult({
        playerId: data.playerId,
        displayName: data.displayName,
        guess: data.guess,
        isCorrect,
        timestamp: Date.now(),
      });

      // Also broadcast for non-host clients
      import("@/lib/game-engine/GameRealtimeService").then(
        ({ gameRealtime }) => {
          gameRealtime.broadcastEvent(room.id, "guess:result", {
            playerId: data.playerId,
            displayName: data.displayName,
            guess: data.guess,
            isCorrect,
          });
        },
      );
    },
    [isHost, game, room.id],
  );

  usePictionaryRealtime({
    roomId: room.id,
    isHost,
    player,
    onGuessReceived,
  });

  const handleStartGame = () => {
    game.startRound();
    startTimer();
  };

  const handleNextRound = () => {
    game.nextRoundOrEnd();
    if (
      game.currentRound <
      game.settings.roundsPerTeam * game.getTeams().length
    ) {
      startTimer();
    }
  };

  // Determine player's role in current round
  const isDrawer = player.id === game.currentDrawerId;
  const isOnActiveTeam = player.teamId === game.currentTeam;
  const isGuesser = isOnActiveTeam && !isDrawer;
  const drawerPlayer = players.find((p) => p.id === game.currentDrawerId);
  const playerNames = Object.fromEntries(
    players.map((p) => [p.id, p.displayName]),
  );

  // Waiting phase
  if (game.phase === "waiting") {
    return (
      <div className="flex flex-col items-center gap-6 p-8">
        <h2 className="text-2xl font-bold">Pictionary</h2>
        <p className="text-muted-foreground">{players.length} players ready</p>
        {isHost ? (
          <Button
            onClick={handleStartGame}
            size="lg"
            disabled={players.length < 2}
          >
            <Play className="mr-1 h-4 w-4" />
            Start Game
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Waiting for host to start...
          </p>
        )}
        {players.length < 2 && (
          <p className="text-sm text-destructive">
            Need at least 2 players to start
          </p>
        )}
      </div>
    );
  }

  // Drawing phase
  if (game.phase === "drawing") {
    if (isDrawer && game.currentWord) {
      return (
        <div className="p-4">
          <DrawerView
            word={game.currentWord}
            timer={timer}
            teamName={game.currentTeam}
          />
        </div>
      );
    }

    if (isGuesser) {
      return (
        <div className="p-4">
          <GuesserView
            timer={timer}
            guesses={game.guesses}
            onGuess={game.submitGuess}
            drawerName={drawerPlayer?.displayName ?? "Someone"}
            isGuessing={game.phase === "drawing" && !game.roundWinner}
          />
        </div>
      );
    }

    return (
      <div className="p-4">
        <SpectatorView
          timer={timer}
          activeTeam={game.currentTeam}
          drawerName={drawerPlayer?.displayName ?? "Someone"}
          scores={game.teamScores}
        />
      </div>
    );
  }

  // Round end
  if (game.phase === "round_end") {
    const totalRounds = game.settings.roundsPerTeam * game.getTeams().length;
    return (
      <div className="p-4">
        <RoundResults
          word={game.currentWord ?? "???"}
          winnerName={
            game.roundWinner ? (playerNames[game.roundWinner] ?? null) : null
          }
          scores={game.teamScores}
          isHost={isHost}
          onNextRound={handleNextRound}
          isLastRound={game.currentRound >= totalRounds}
        />
      </div>
    );
  }

  // Game over
  if (game.phase === "game_over") {
    return (
      <div className="p-4">
        <GameOverScreen
          teamScores={game.teamScores}
          playerScores={game.scores}
          playerNames={playerNames}
          isHost={isHost}
          onPlayAgain={game.resetGame}
        />
      </div>
    );
  }

  return null;
}
