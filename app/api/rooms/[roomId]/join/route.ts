import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const supabase = await createClient();
  const body = await request.json();
  const { displayName, guestToken: clientGuestToken } = body;

  if (!displayName?.trim()) {
    return NextResponse.json(
      { error: "Display name is required" },
      { status: 400 }
    );
  }

  // Check room exists
  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .select("id, status, max_players")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Get current user (may be null for guests)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Rejoin check ─────────────────────────────────────────────────────────
  // Before rejecting a game-in-progress, check if this player was already in the room.
  if (room.status !== "waiting") {
    let existingPlayer = null;

    if (user) {
      // Authenticated: look up by user_id
      const { data } = await supabase
        .from("game_players")
        .select("id, guest_token")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .maybeSingle();
      existingPlayer = data;
    } else if (clientGuestToken) {
      // Guest: look up by the token stored in their localStorage
      const { data } = await supabase
        .from("game_players")
        .select("id, guest_token")
        .eq("room_id", roomId)
        .eq("guest_token", clientGuestToken)
        .maybeSingle();
      existingPlayer = data;
    }

    if (existingPlayer) {
      // Rejoin — return existing player identity so the client can restore state
      return NextResponse.json({
        player: {
          id: existingPlayer.id,
          guestToken: existingPlayer.guest_token,
        },
        rejoined: true,
      });
    }

    // Truly a new player trying to join a game already in progress
    return NextResponse.json(
      { error: "Game has already started" },
      { status: 400 }
    );
  }

  // ── Normal join (room is waiting) ────────────────────────────────────────
  const { count } = await supabase
    .from("game_players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId)
    .is("left_at", null);

  if ((count ?? 0) >= room.max_players) {
    return NextResponse.json({ error: "Room is full" }, { status: 400 });
  }

  const guestToken = user ? null : crypto.randomUUID();

  const { data: player, error: playerError } = await supabase
    .from("game_players")
    .insert({
      room_id: roomId,
      user_id: user?.id ?? null,
      display_name: displayName.trim(),
      role: "player",
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
    player: {
      id: player.id,
      guestToken,
    },
    rejoined: false,
  });
}
