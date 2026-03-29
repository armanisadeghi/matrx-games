import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const { roomId, playerId, roundNumber, points, metadata = {} } = body;

  const { error } = await supabase.from("game_scores").insert({
    room_id: roomId,
    player_id: playerId,
    round_number: roundNumber,
    points,
    metadata,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
