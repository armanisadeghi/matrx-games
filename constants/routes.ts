export const ROUTES = {
  HOME: "/",
  GAMES: "/games",
  GAME: (slug: string) => `/games/${slug}`,
  PLAY: (roomCode: string) => `/play/${roomCode}`,
  LEADERBOARD: (slug: string) => `/leaderboard/${slug}`,
  ROOM_CREATE: (gameSlug: string) => `/room/create/${gameSlug}`,
  ROOM: (roomId: string) => `/room/${roomId}`,
  ROOM_PLAY: (roomId: string) => `/room/${roomId}/play`,
  DASHBOARD: "/dashboard",
  PROFILE: "/profile",
  HISTORY: "/history",
  LOGIN: "/login",
} as const;
