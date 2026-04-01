"use client";

import { Pencil } from "lucide-react";
import { GameTimer } from "@/features/timer/components/GameTimer";
import { DIFFICULTY_CONFIG } from "../constants";
import type { TimerState } from "@/features/timer/types";
import type { PictionaryDifficultyLevel } from "../types";

interface DrawerViewProps {
  word: string;
  timer: TimerState;
  teamName: string;
  category?: string;
  difficulty?: PictionaryDifficultyLevel;
  pointValue?: number;
}

export function DrawerView({
  word,
  timer,
  teamName,
  category,
  difficulty,
  pointValue,
}: DrawerViewProps) {
  const diffCfg = difficulty ? DIFFICULTY_CONFIG[difficulty] : null;

  return (
    <div className="flex flex-1 flex-col items-center gap-6">
      {/* Role badge + difficulty */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="flex items-center gap-2 rounded-full bg-[oklch(0.75_0.18_150)]/20 px-4 py-2 text-sm font-semibold text-[oklch(0.55_0.18_150)] dark:text-[oklch(0.8_0.18_150)]">
          <Pencil className="h-4 w-4" />
          You are drawing
        </div>
        {diffCfg && (
          <div
            className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold ${diffCfg.bg} ${diffCfg.border} ${diffCfg.color}`}
          >
            {diffCfg.label}
            <span className="ml-1 opacity-70">·</span>
            {pointValue ?? diffCfg.points} pts
          </div>
        )}
      </div>

      {/* Word card */}
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-[oklch(0.75_0.18_150)]/30 bg-[oklch(0.75_0.18_150)]/10 p-8">
        {category && (
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            {category}
          </p>
        )}
        <p className="text-center text-5xl font-black tracking-tight text-[oklch(0.5_0.18_150)] dark:text-[oklch(0.8_0.18_150)] md:text-6xl">
          {word}
        </p>
        <p className="mt-2 text-center text-base text-muted-foreground">
          Describe this to {teamName} without saying the word!
        </p>
      </div>

      {/* Timer */}
      <div className="w-full">
        <GameTimer timer={timer} size="lg" className="w-full" />
      </div>

      <p className="text-center text-lg font-medium text-muted-foreground">
        Your team is guessing...
      </p>
    </div>
  );
}
