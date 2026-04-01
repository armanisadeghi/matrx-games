"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { gameRealtime } from "@/lib/game-engine/GameRealtimeService";
import type { GameComponentProps } from "@/games/types";
import { usePictionaryGame } from "../hooks/usePictionaryGame";
import { usePictionaryRealtime } from "../hooks/usePictionaryRealtime";
import { useSyncedTimer } from "@/features/timer/hooks/useSyncedTimer";
import { DrawerView } from "./DrawerView";
import { GuesserView } from "./GuesserView";
import { SpectatorView } from "./SpectatorView";
import { RoundResults } from "./RoundResults";
import { GameOverScreen } from "./GameOverScreen";
import { DifficultyPicker } from "./DifficultyPicker";
import { PreviewView } from "./PreviewView";
import { EmergencyReset } from "./EmergencyReset";
import { TimerExpiredOverlay } from "@/features/timer/components/TimerExpiredOverlay";
import type { PictionarySettings, PictionaryDifficultyLevel } from "../types";

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

  const onGuessReceived = useCallback(
    (data: { playerId: string; displayName: string; guess: string }) => {
      if (!isHost || !game.currentWord) return;

      const isCorrect =
        data.guess.toLowerCase().trim() ===
        game.currentWord.toLowerCase().trim();

      game.handleGuessResult({
        playerId: data.playerId,
        displayName: data.displayName,
        guess: data.guess,
        isCorrect,
        timestamp: Date.now(),
      });

      gameRealtime.broadcastEvent(room.id, "guess:result", {
        playerId: data.playerId,
        displayName: data.displayName,
        guess: data.guess,
        isCorrect,
      });
    },
    [isHost, game, room.id],
  );

  // Host handles skip requests from the drawer
  const onDrawerSkip = useCallback(
    (drawerId: string) => {
      if (!isHost) return;
      game.skipDrawer();
      gameRealtime.broadcastEvent(room.id, "drawer:skip", { drawerId });
    },
    [isHost, game, room.id],
  );

  usePictionaryRealtime({
    roomId: room.id,
    isHost,
    player,
    onGuessReceived,
    onDrawerSkip,
  });

  const isDrawer = player.id === game.currentDrawerId;
  const isOnActiveTeam = player.teamId === game.currentTeam;
  const isGuesser = isOnActiveTeam && !isDrawer;
  const drawerPlayer = players.find((p) => p.id === game.currentDrawerId);
  const playerNames = Object.fromEntries(
    players.map((p) => [p.id, p.displayName]),
  );

  const handleStartGame = () => {
    game.startRound();
  };

  const handleDifficultyChosen = (difficulty: PictionaryDifficultyLevel) => {
    game.confirmDifficulty(difficulty);
  };

  // Called by the drawer's skip button — broadcasts to host who calls skipDrawer()
  const handleSelfSkip = () => {
    gameRealtime.broadcastEvent(room.id, "drawer:skip", {
      drawerId: player.id,
    });
    // If this player IS the host, handle it directly
    if (isHost) game.skipDrawer();
  };

  // Called when PreviewView countdown ends — only the drawer's client triggers this
  const handlePreviewComplete = () => {
    if (!isDrawer) return;
    game.startDrawing();
    startTimer();
  };

  const handleNextRound = () => {
    game.nextRoundOrEnd();
  };

  // Emergency reset — available in all active phases
  const showEmergencyReset =
    game.phase !== "waiting" && game.phase !== "game_over";

  // ── Waiting ──────────────────────────────────────────────────────────────
  if (game.phase === "waiting") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
        <div className="flex flex-col items-center gap-2">
          <span className="text-5xl">🎨</span>
          <h2 className="text-4xl font-bold tracking-tight">Pictionary</h2>
          <p className="text-lg text-muted-foreground">
            {players.length} {players.length === 1 ? "player" : "players"} ready
          </p>
        </div>
        {isHost ? (
          <Button
            onClick={handleStartGame}
            size="lg"
            className="h-16 w-full max-w-xs text-xl"
            disabled={players.length < 2}
          >
            <Play className="mr-2 h-6 w-6" />
            Start Game
          </Button>
        ) : (
          <p className="text-center text-lg text-muted-foreground">
            Waiting for host to start...
          </p>
        )}
        {players.length < 2 && (
          <p className="text-base text-destructive">
            Need at least 2 players to start
          </p>
        )}
      </div>
    );
  }

  // ── Picking difficulty ───────────────────────────────────────────────────
  if (game.phase === "picking_difficulty") {
    return (
      <div className="flex min-h-dvh flex-col p-4 pt-6">
        <DifficultyPicker
          isDrawer={isDrawer}
          drawerName={drawerPlayer?.displayName ?? "Someone"}
          roundNumber={game.currentRound}
          teamName={game.currentTeam}
          onPick={handleDifficultyChosen}
          onSkip={isDrawer ? handleSelfSkip : undefined}
        />
        {showEmergencyReset && (
          <EmergencyReset
            roomId={room.id}
            playerId={player.id}
            playerName={player.displayName}
            onReset={game.resetGame}
          />
        )}
      </div>
    );
  }

  // ── Previewing word ──────────────────────────────────────────────────────
  if (game.phase === "previewing") {
    return (
      <div className="flex min-h-dvh flex-col p-4 pt-6">
        <PreviewView
          isDrawer={isDrawer}
          word={game.currentWord}
          category={game.currentWordCategory ?? undefined}
          difficulty={game.currentWordDifficulty ?? undefined}
          pointValue={game.currentPointValue}
          drawerName={drawerPlayer?.displayName ?? "Someone"}
          onPreviewComplete={handlePreviewComplete}
        />
        {showEmergencyReset && (
          <EmergencyReset
            roomId={room.id}
            playerId={player.id}
            playerName={player.displayName}
            onReset={game.resetGame}
          />
        )}
      </div>
    );
  }

  // ── Drawing ───────────────────────────────────────────────────────────────
  if (game.phase === "drawing") {
    return (
      <div className="relative flex min-h-dvh flex-col p-4 pt-6">
        <TimerExpiredOverlay timer={timer} />

        {isDrawer && game.currentWord ? (
          <DrawerView
            word={game.currentWord}
            category={game.currentWordCategory ?? undefined}
            difficulty={game.currentWordDifficulty ?? undefined}
            pointValue={game.currentPointValue}
            timer={timer}
            teamName={game.currentTeam}
          />
        ) : isGuesser ? (
          <GuesserView
            timer={timer}
            guesses={game.guesses}
            onGuess={game.submitGuess}
            drawerName={drawerPlayer?.displayName ?? "Someone"}
            category={game.currentWordCategory ?? undefined}
            difficulty={game.currentWordDifficulty ?? undefined}
            pointValue={game.currentPointValue}
            isGuessing={!game.roundWinner}
          />
        ) : (
          <SpectatorView
            timer={timer}
            activeTeam={game.currentTeam}
            drawerName={drawerPlayer?.displayName ?? "Someone"}
            scores={game.teamScores}
            difficulty={game.currentWordDifficulty ?? undefined}
            pointValue={game.currentPointValue}
          />
        )}

        <EmergencyReset
          roomId={room.id}
          playerId={player.id}
          playerName={player.displayName}
          onReset={game.resetGame}
        />
      </div>
    );
  }

  // ── Round end ─────────────────────────────────────────────────────────────
  if (game.phase === "round_end") {
    const totalRounds = game.settings.roundsPerTeam * game.getTeams().length;
    return (
      <div className="flex min-h-dvh flex-col p-4 pt-6">
        <RoundResults
          word={game.currentWord ?? "???"}
          category={game.currentWordCategory ?? undefined}
          difficulty={game.currentWordDifficulty ?? undefined}
          pointValue={game.currentPointValue}
          winnerName={
            game.roundWinner ? (playerNames[game.roundWinner] ?? null) : null
          }
          scores={game.teamScores}
          isHost={isHost}
          onNextRound={handleNextRound}
          isLastRound={game.currentRound >= totalRounds}
        />
        <EmergencyReset
          roomId={room.id}
          playerId={player.id}
          playerName={player.displayName}
          onReset={game.resetGame}
        />
      </div>
    );
  }

  // ── Game over ─────────────────────────────────────────────────────────────
  if (game.phase === "game_over") {
    return (
      <div className="flex min-h-dvh flex-col p-4 pt-6">
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
