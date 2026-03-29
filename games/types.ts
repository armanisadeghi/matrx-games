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
