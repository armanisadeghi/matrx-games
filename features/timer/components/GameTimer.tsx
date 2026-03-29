"use client";

import { cn } from "@/lib/utils";
import type { TimerState } from "../types";

interface GameTimerProps {
  timer: TimerState;
  className?: string;
  size?: "sm" | "md" | "lg";
}

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function GameTimer({ timer, className, size = "md" }: GameTimerProps) {
  const percentage = timer.duration > 0 ? (timer.remaining / timer.duration) * 100 : 0;
  const isLow = timer.remaining <= 10000 && timer.remaining > 0;
  const isExpired = timer.remaining <= 0 && timer.isRunning === false && timer.startedAt !== null;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2",
        className
      )}
    >
      <div
        className={cn(
          "font-mono font-bold tabular-nums",
          size === "sm" && "text-2xl",
          size === "md" && "text-4xl",
          size === "lg" && "text-6xl",
          isLow && "text-destructive animate-pulse",
          isExpired && "text-muted-foreground"
        )}
      >
        {formatTime(timer.remaining)}
      </div>
      <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-100",
            isLow ? "bg-destructive" : "bg-primary"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
