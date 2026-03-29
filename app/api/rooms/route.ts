import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateRoomCode } from "@/lib/room/code-generator";

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const { gameSlug, displayName, maxPlayers = 10, settings = {} } = body;

  // Look up the game
  const { data: game, error: gameError } = await supabase
    .from("game_catalog")
    .select("id")
    .eq("slug", gameSlug)
    .single();

  if (gameError || !game) {
    return NextResponse.json(
      { error: "Game not found" },
      { status: 404 }
    );
  }

  // Get current user (may be null for guests)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Generate unique room code
  let roomCode = generateRoomCode();
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from("game_rooms")
      .select("id")
      .eq("room_code", roomCode)
      .single();
    if (!existing) break;
    roomCode = generateRoomCode();
    attempts++;
  }

  // Create room
  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .insert({
      game_id: game.id,
      host_id: user?.id ?? null,
      room_code: roomCode,
      status: "waiting",
      settings,
      max_players: maxPlayers,
    })
    .select()
    .single();

  if (roomError) {
    return NextResponse.json(
      { error: roomError.message },
      { status: 500 }
    );
  }

  // Add host as first player
  const guestToken = user ? null : crypto.randomUUID();
  const { data: player, error: playerError } = await supabase
    .from("game_players")
    .insert({
      room_id: room.id,
      user_id: user?.id ?? null,
      display_name: displayName,
      role: "host",
      guest_token: guestToken,
    })
    .select()
    .single();

  if (playerError) {
    return NextResponse.json(
      { error: playerError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    room: {
      id: room.id,
      roomCode: room.room_code,
      status: room.status,
    },
    player: {
      id: player.id,
      guestToken,
    },
  });
}
