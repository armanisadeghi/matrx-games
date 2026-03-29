import type { Player, Room } from "@/games/types";

export interface CreateRoomInput {
  gameSlug: string;
  hostDisplayName: string;
  maxPlayers?: number;
  settings?: Record<string, unknown>;
}

export interface JoinRoomInput {
  roomCode: string;
  displayName: string;
  userId?: string;
  guestToken?: string;
}

export interface RoomState {
  room: Room | null;
  players: Player[];
  currentPlayer: Player | null;
  isHost: boolean;
  isLoading: boolean;
  error: string | null;
}
