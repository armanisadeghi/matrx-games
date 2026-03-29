export interface TimerState {
  startedAt: number | null;
  duration: number;
  isPaused: boolean;
  pausedAt: number | null;
  isRunning: boolean;
  remaining: number;
}

export interface TimerConfig {
  duration: number;
  onComplete?: () => void;
  onTick?: (remaining: number) => void;
}
