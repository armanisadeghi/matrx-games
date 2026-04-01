"use client";

import { Button } from "@/components/ui/button";
import { Trophy, RotateCcw, Home } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/constants/routes";

interface GameOverScreenProps {
  teamScores: Record<string, number>;
  playerScores: Record<string, number>;
  playerNames: Record<string, string>;
  isHost: boolean;
  onPlayAgain: () => void;
}

export function GameOverScreen({
  teamScores,
  playerScores,
  playerNames,
  isHost,
  onPlayAgain,
}: GameOverScreenProps) {
  const sortedTeams = Object.entries(teamScores).sort(([, a], [, b]) => b - a);
  const sortedPlayers = Object.entries(playerScores).sort(
    ([, a], [, b]) => b - a,
  );
  const winner = sortedTeams[0];

  return (
    <div className="flex flex-1 flex-col items-center gap-6">
      {/* Header */}
      <div className="flex flex-col items-center gap-2">
        <Trophy className="h-16 w-16 text-[oklch(0.78_0.18_85)]" />
        <h2 className="text-5xl font-black tracking-tight">Game Over!</h2>
      </div>

      {/* Winner banner */}
      {winner && (
        <div className="w-full rounded-2xl border-2 border-[oklch(0.78_0.18_85)]/40 bg-[oklch(0.78_0.18_85)]/10 p-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Winner
          </p>
          <p className="mt-1 text-4xl font-black">{winner[0]}</p>
          <p className="font-mono text-2xl font-bold text-[oklch(0.65_0.18_85)] dark:text-[oklch(0.82_0.18_85)]">
            {winner[1]} pts
          </p>
        </div>
      )}

      {/* Team leaderboard */}
      <div className="w-full rounded-2xl border bg-card p-5">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Team Scores
        </p>
        <div className="flex flex-col gap-2">
          {sortedTeams.map(([team, score], i) => (
            <div
              key={team}
              className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                i === 0
                  ? "bg-[oklch(0.78_0.18_85)]/12 border border-[oklch(0.78_0.18_85)]/25"
                  : "bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-xl font-black ${
                    i === 0
                      ? "text-[oklch(0.65_0.18_85)] dark:text-[oklch(0.82_0.18_85)]"
                      : "text-muted-foreground"
                  }`}
                >
                  #{i + 1}
                </span>
                <span className="text-lg font-semibold">{team}</span>
              </div>
              <span className="font-mono text-2xl font-bold">{score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Player leaderboard */}
      <div className="w-full rounded-2xl border bg-card p-5">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Top Players
        </p>
        <div className="flex flex-col gap-2">
          {sortedPlayers.slice(0, 5).map(([id, score], i) => (
            <div
              key={id}
              className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-lg font-black ${
                    i === 0
                      ? "text-[oklch(0.7_0.18_260)] dark:text-[oklch(0.8_0.18_260)]"
                      : i === 1
                        ? "text-muted-foreground"
                        : "text-muted-foreground/60"
                  }`}
                >
                  #{i + 1}
                </span>
                <span className="text-lg font-semibold">
                  {playerNames[id] ?? "Unknown"}
                </span>
              </div>
              <span className="font-mono text-xl font-bold">{score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex w-full flex-col gap-3">
        {isHost && (
          <Button
            onClick={onPlayAgain}
            size="lg"
            className="h-14 w-full text-lg"
          >
            <RotateCcw className="mr-2 h-5 w-5" />
            Play Again
          </Button>
        )}
        <Button
          variant="outline"
          size="lg"
          className="h-14 w-full text-lg"
          render={<Link href={ROUTES.HOME} />}
        >
          <Home className="mr-2 h-5 w-5" />
          Back to Games
        </Button>
      </div>
    </div>
  );
}
