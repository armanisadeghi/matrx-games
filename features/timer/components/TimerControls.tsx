"use client";

import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";
import type { TimerState } from "../types";

interface TimerControlsProps {
  timer: TimerState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  disabled?: boolean;
}

export function TimerControls({
  timer,
  onStart,
  onPause,
  onResume,
  onReset,
  disabled,
}: TimerControlsProps) {
  return (
    <div className="flex items-center gap-2">
      {!timer.isRunning && !timer.startedAt && (
        <Button onClick={onStart} disabled={disabled} size="sm">
          <Play className="mr-1 h-4 w-4" />
          Start
        </Button>
      )}
      {timer.isRunning && (
        <Button onClick={onPause} disabled={disabled} size="sm" variant="secondary">
          <Pause className="mr-1 h-4 w-4" />
          Pause
        </Button>
      )}
      {timer.isPaused && (
        <Button onClick={onResume} disabled={disabled} size="sm">
          <Play className="mr-1 h-4 w-4" />
          Resume
        </Button>
      )}
      {timer.startedAt && (
        <Button onClick={onReset} disabled={disabled} size="sm" variant="outline">
          <RotateCcw className="mr-1 h-4 w-4" />
          Reset
        </Button>
      )}
    </div>
  );
}
