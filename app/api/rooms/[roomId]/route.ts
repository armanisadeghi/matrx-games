import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const supabase = await createClient();

  const { data: room, error } = await supabase
    .from("game_rooms")
    .select("*, game_catalog(slug, name)")
    .eq("id", roomId)
    .single();

  if (error || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const { data: players } = await supabase
    .from("game_players")
    .select("*")
    .eq("room_id", roomId)
    .is("left_at", null);

  return NextResponse.json({ room, players: players ?? [] });
}
