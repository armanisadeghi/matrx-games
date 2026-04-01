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
  const percentage =
    timer.duration > 0 ? (timer.remaining / timer.duration) * 100 : 0;
  const isLow = timer.remaining <= 10000 && timer.remaining > 0;
  const isVeryLow = timer.remaining <= 5000 && timer.remaining > 0;
  const isExpired =
    timer.remaining <= 0 &&
    timer.isRunning === false &&
    timer.startedAt !== null;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div
        className={cn(
          "font-mono font-black tabular-nums transition-colors duration-300",
          size === "sm" && "text-3xl",
          size === "md" && "text-5xl",
          size === "lg" && "text-7xl",
          !isLow && !isExpired && "text-foreground",
          isLow &&
            !isVeryLow &&
            "text-[oklch(0.72_0.18_50)] dark:text-[oklch(0.82_0.18_50)]",
          isVeryLow &&
            "animate-pulse text-[oklch(0.6_0.22_25)] dark:text-[oklch(0.72_0.22_25)]",
          isExpired && "text-muted-foreground",
        )}
      >
        {formatTime(timer.remaining)}
      </div>

      {/* Progress bar */}
      <div className="h-3 w-full max-w-sm overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-150",
            !isLow && "bg-[oklch(0.7_0.18_260)]",
            isLow && !isVeryLow && "bg-[oklch(0.72_0.18_50)]",
            isVeryLow && "bg-[oklch(0.6_0.22_25)]",
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
