"use client";

import { useEffect, useState } from "react";
import { Eye, Pencil } from "lucide-react";
import { DIFFICULTY_CONFIG } from "../constants";
import type { PictionaryDifficultyLevel } from "../types";

const PREVIEW_SECONDS = 10;

interface PreviewViewProps {
  isDrawer: boolean;
  word: string | null;
  category?: string;
  difficulty?: PictionaryDifficultyLevel;
  pointValue?: number;
  drawerName: string;
  onPreviewComplete: () => void;
}

export function PreviewView({
  isDrawer,
  word,
  category,
  difficulty,
  pointValue,
  drawerName,
  onPreviewComplete,
}: PreviewViewProps) {
  const [secondsLeft, setSecondsLeft] = useState(PREVIEW_SECONDS);
  const diffCfg = difficulty ? DIFFICULTY_CONFIG[difficulty] : null;

  useEffect(() => {
    if (secondsLeft <= 0) {
      onPreviewComplete();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, onPreviewComplete]);

  const urgency = secondsLeft <= 3;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      {/* Countdown circle */}
      <div
        className={`flex h-24 w-24 items-center justify-center rounded-full border-4 font-black text-5xl tabular-nums transition-colors ${
          urgency
            ? "animate-pulse border-[oklch(0.6_0.22_25)] text-[oklch(0.6_0.22_25)]"
            : "border-[oklch(0.7_0.18_260)] text-[oklch(0.7_0.18_260)]"
        }`}
      >
        {secondsLeft}
      </div>

      {isDrawer ? (
        <>
          <div className="flex items-center gap-2 rounded-full bg-[oklch(0.75_0.18_150)]/20 px-4 py-2 text-sm font-semibold text-[oklch(0.55_0.18_150)] dark:text-[oklch(0.8_0.18_150)]">
            <Pencil className="h-4 w-4" />
            Memorise your word!
          </div>

          <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border-2 border-[oklch(0.75_0.18_150)]/30 bg-[oklch(0.75_0.18_150)]/10 p-8 text-center">
            {category && (
              <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                {category}
              </p>
            )}
            <p className="text-5xl font-black tracking-tight text-[oklch(0.5_0.18_150)] dark:text-[oklch(0.8_0.18_150)]">
              {word}
            </p>
            {diffCfg && (
              <span
                className={`mt-1 rounded-full border px-3 py-1 text-sm font-bold ${diffCfg.bg} ${diffCfg.border} ${diffCfg.color}`}
              >
                {diffCfg.label} · {pointValue ?? diffCfg.points} pts
              </span>
            )}
          </div>

          <p className="text-center text-base text-muted-foreground">
            Drawing starts in {secondsLeft}s — get ready!
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground">
            <Eye className="h-4 w-4" />
            Get ready to guess
          </div>

          <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-2xl border bg-card p-8 text-center">
            <p className="text-lg text-muted-foreground">
              <span className="font-bold text-foreground">{drawerName}</span> is
              studying their word...
            </p>
            {diffCfg && (
              <span
                className={`mt-2 rounded-full border px-3 py-1 text-sm font-bold ${diffCfg.bg} ${diffCfg.border} ${diffCfg.color}`}
              >
                {diffCfg.label} · {pointValue ?? diffCfg.points} pts at stake
              </span>
            )}
            {category && (
              <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-sm font-medium text-muted-foreground">
                {category}
              </span>
            )}
          </div>

          <p className="text-center text-base text-muted-foreground">
            Guessing opens in {secondsLeft}s
          </p>
        </>
      )}
    </div>
  );
}
