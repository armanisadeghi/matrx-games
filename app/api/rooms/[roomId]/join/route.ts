import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const supabase = await createClient();
  const body = await request.json();
  const { displayName } = body;

  if (!displayName?.trim()) {
    return NextResponse.json(
      { error: "Display name is required" },
      { status: 400 }
    );
  }

  // Check room exists and is joinable
  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .select("id, status, max_players")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.status !== "waiting") {
    return NextResponse.json(
      { error: "Game has already started" },
      { status: 400 }
    );
  }

  // Check player count
  const { count } = await supabase
    .from("game_players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId)
    .is("left_at", null);

  if ((count ?? 0) >= room.max_players) {
    return NextResponse.json({ error: "Room is full" }, { status: 400 });
  }

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  });
}
