import { NextResponse } from "next/server";
import { callAgent, type AgentRequest } from "@/lib/aidream/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  const body: AgentRequest = await request.json();

  try {
    const upstream = await callAgent(agentId, body);

    if (!upstream.body) {
      return NextResponse.json(
        { error: "No response body from agent" },
        { status: 502 },
      );
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
