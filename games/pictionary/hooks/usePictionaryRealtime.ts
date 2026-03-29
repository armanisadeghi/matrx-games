"use client";

import { useEffect } from "react";
import { gameRealtime } from "@/lib/game-engine/GameRealtimeService";
import { usePictionaryStore } from "../state/pictionaryStore";
import type { Player } from "@/games/types";

interface UsePictionaryRealtimeOptions {
  roomId: string;
  isHost: boolean;
  player: Player;
  onGuessReceived?: (guess: {
    playerId: string;
    displayName: string;
    guess: string;
  }) => void;
}

export function usePictionaryRealtime({
  roomId,
  isHost,
  player,
  onGuessReceived,
}: UsePictionaryRealtimeOptions) {
  const store = usePictionaryStore();

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    // Listen for round:start
    unsubs.push(
      gameRealtime.onBroadcast(roomId, "round:start", (payload) => {
        const data = payload as {
          roundNumber: number;
          teamId: string;
          drawerId: string;
        };
        store.setCurrentRound(data.roundNumber, data.teamId, data.drawerId);
        store.setPhase("drawing");
      })
    );

    // Listen for word:assigned (only drawer reads this)
    unsubs.push(
      gameRealtime.onBroadcast(roomId, "word:assigned", (payload) => {
        const data = payload as { word: string };
        if (player.id === store.currentDrawerId) {
          store.setWord(data.word);
        }
      })
    );

    // Listen for guess:submit (host validates)
    if (isHost) {
      unsubs.push(
        gameRealtime.onBroadcast(roomId, "guess:submit", (payload) => {
          const data = payload as {
            playerId: string;
            displayName: string;
            guess: string;
          };
          onGuessReceived?.(data);
        })
      );
    }

    // Listen for guess:result (everyone)
    unsubs.push(
      gameRealtime.onBroadcast(roomId, "guess:result", (payload) => {
        const data = payload as {
          playerId: string;
          displayName: string;
          guess: string;
          isCorrect: boolean;
        };
        store.addGuess({ ...data, timestamp: Date.now() });
      })
    );

    // Listen for round:end
    unsubs.push(
      gameRealtime.onBroadcast(roomId, "round:end", (payload) => {
        const data = payload as {
          word: string;
          winnerId: string | null;
          scores: Record<string, number>;
          teamScores: Record<string, number>;
        };
        store.setWord(data.word);
        store.setRoundWinner(data.winnerId);
        store.updateScores(data.scores, data.teamScores);
        store.setPhase("round_end");
      })
    );

    // Listen for game:end
    unsubs.push(
      gameRealtime.onBroadcast(roomId, "game:end", (payload) => {
        const data = payload as {
          scores: Record<string, number>;
          teamScores: Record<string, number>;
        };
        store.updateScores(data.scores, data.teamScores);
        store.setPhase("game_over");
      })
    );

    // Listen for game:state reset
    unsubs.push(
      gameRealtime.onBroadcast(roomId, "game:state", (payload) => {
        const data = payload as { action: string };
        if (data.action === "reset") {
          store.reset();
        }
      })
    );

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [roomId, isHost, player.id, store, onGuessReceived]);
}
