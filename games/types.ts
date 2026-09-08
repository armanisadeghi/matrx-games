import type { LucideIcon } from "lucide-react";

export interface Player {
  id: string;
  userId: string | null;
  displayName: string;
  avatarUrl: string | null;
  teamId: string | null;
  role: "host" | "player" | "spectator";
  gameRole: string | null;
  isConnected: boolean;
  guestToken: string | null;
}

export interface Room {
  id: string;
  gameId: string;
  gameSlug: string;
  hostId: string | null;
  roomCode: string;
  status: "waiting" | "playing" | "paused" | "finished" | "abandoned";
  settings: Record<string, unknown>;
  maxPlayers: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

/**
 * DB → domain narrowers. Postgres stores `status` and `role` as text and
 * `settings` as jsonb, so a generated row type hands back `string` / `Json`
 * where this module declares a union. These are the ONE boundary where that
 * widening is resolved — and they REFUSE an unknown value loudly instead of
 * casting it into a union it does not belong to, which is how a room in an
 * unrecognized state silently renders as "waiting".
 */
export const ROOM_STATUSES = [
  "waiting",
  "playing",
  "paused",
  "finished",
  "abandoned",
] as const;

export const PLAYER_ROLES = ["host", "player", "spectator"] as const;

export function asRoomStatus(value: string): Room["status"] {
  const known = ROOM_STATUSES.find((status) => status === value);
  if (!known) {
    throw new Error(
      `Unrecognized room status "${value}" — expected one of ${ROOM_STATUSES.join(", ")}.`,
    );
  }
  return known;
}

export function asPlayerRole(value: string): Player["role"] {
  const known = PLAYER_ROLES.find((role) => role === value);
  if (!known) {
    throw new Error(
      `Unrecognized player role "${value}" — expected one of ${PLAYER_ROLES.join(", ")}.`,
    );
  }
  return known;
}

/** A jsonb column is only settings when it is actually an object. */
export function asRoomSettings(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (value !== null && value !== undefined) {
    console.warn(
      "[room] settings column is not a JSON object; falling back to {}.",
      value,
    );
  }
  return {};
}

export interface TeamConfig {
  count: number;
  minPerTeam: number;
  maxPerTeam: number;
  names?: string[];
}

export interface GameComponentProps {
  room: Room;
  player: Player;
  players: Player[];
  gameState: Record<string, unknown>;
  isHost: boolean;
  broadcastEvent: (event: string, payload: unknown) => void;
  onBroadcast: (event: string, handler: (payload: unknown) => void) => () => void;
}

export interface LobbyComponentProps {
  room: Room;
  player: Player;
  players: Player[];
  isHost: boolean;
}

export interface GameDefinition {
  slug: string;
  name: string;
  description: string;
  icon: LucideIcon;
  minPlayers: number;
  maxPlayers: number;
  supportsTeams: boolean;
  supportsSinglePlayer: boolean;
  defaultSettings: Record<string, unknown>;
  roles?: string[];
  teams?: TeamConfig;
  GameComponent: React.ComponentType<GameComponentProps>;
  LobbyComponent?: React.ComponentType<LobbyComponentProps>;
}
