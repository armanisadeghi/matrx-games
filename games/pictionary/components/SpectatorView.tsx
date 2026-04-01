"use client";

import { Eye } from "lucide-react";
import { GameTimer } from "@/features/timer/components/GameTimer";
import { DIFFICULTY_CONFIG } from "../constants";
import type { TimerState } from "@/features/timer/types";
import type { PictionaryDifficultyLevel } from "../types";

interface SpectatorViewProps {
  timer: TimerState;
  activeTeam: string;
  drawerName: string;
  scores: Record<string, number>;
  difficulty?: PictionaryDifficultyLevel;
  pointValue?: number;
}

export function SpectatorView({
  timer,
  activeTeam,
  drawerName,
  scores,
  difficulty,
  pointValue,
}: SpectatorViewProps) {
  const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const diffCfg = difficulty ? DIFFICULTY_CONFIG[difficulty] : null;

  return (
    <div className="flex flex-1 flex-col items-center gap-6">
      {/* Role badge */}
      <div className="flex items-center gap-2 rounded-full bg-[oklch(0.7_0.15_50)]/15 px-4 py-2 text-sm font-semibold text-[oklch(0.55_0.15_50)] border border-[oklch(0.7_0.15_50)]/25 dark:text-[oklch(0.8_0.15_50)]">
        <Eye className="h-4 w-4" />
        Spectating
      </div>

      {/* Timer */}
      <GameTimer timer={timer} size="lg" className="w-full" />

      {/* Active team card */}
      <div className="flex w-full flex-col items-center gap-2 rounded-2xl border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground uppercase tracking-widest">
          Currently playing
        </p>
        <p className="text-3xl font-bold">{activeTeam}</p>
        <p className="text-base text-muted-foreground">
          {drawerName} is describing a word to their team
        </p>
        {diffCfg && (
          <span
            className={`mt-1 rounded-full border px-3 py-1 text-sm font-bold ${diffCfg.bg} ${diffCfg.border} ${diffCfg.color}`}
          >
            {diffCfg.label} · {pointValue ?? diffCfg.points} pts at stake
          </span>
        )}
      </div>

      {/* Scores */}
      {sortedScores.length > 0 && (
        <div className="w-full rounded-2xl border bg-card p-5">
          <p className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-widest">
            Scores
          </p>
          <div className="flex flex-col gap-2">
            {sortedScores.map(([team, score], i) => (
              <div
                key={team}
                className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-lg font-black ${
                      i === 0
                        ? "text-[oklch(0.75_0.18_50)] dark:text-[oklch(0.85_0.18_50)]"
                        : "text-muted-foreground"
                    }`}
                  >
                    #{i + 1}
                  </span>
                  <span className="text-lg font-semibold">{team}</span>
                </div>
                <span className="font-mono text-xl font-bold">{score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
