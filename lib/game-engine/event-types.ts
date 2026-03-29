export type RoomEvent =
  | "player:joined"
  | "player:left"
  | "game:start"
  | "game:pause"
  | "game:resume"
  | "game:end"
  | "round:start"
  | "round:end"
  | "timer:sync"
  | "timer:start"
  | "timer:pause"
  | "timer:reset"
  | "role:assign"
  | "team:update"
  | "score:update"
  | "game:state";

export interface TimerSyncPayload {
  startedAt: number;
  duration: number;
  isPaused: boolean;
  pausedAt: number | null;
}

export interface PlayerEventPayload {
  playerId: string;
  displayName: string;
  teamId: string | null;
}

export interface RoundStartPayload {
  roundNumber: number;
  teamId: string;
  activePlayerId?: string;
}

export interface ScoreUpdatePayload {
  scores: Record<string, number>;
}
