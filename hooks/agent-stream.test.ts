import { describe, expect, it, vi } from "vitest";

import { consumeAgentStream, type AgentProtocolIssue } from "./agent-stream";

function byteStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function splitInsideUtf8(text: string, marker: string): Uint8Array[] {
  const bytes = new TextEncoder().encode(text);
  const markerBytes = new TextEncoder().encode(marker);
  const markerStart = bytes.findIndex((value, index) =>
    markerBytes.every((part, offset) => bytes[index + offset] === part),
  );
  return [bytes.slice(0, markerStart + 1), bytes.slice(markerStart + 1)];
}

describe("consumeAgentStream", () => {
  it("shares canonical framing for split UTF-8, compact chunks, malformed siblings, and trailing completion", async () => {
    const wire = [
      JSON.stringify({ event: "chunk", data: { text: "Hello " } }),
      "{broken}",
      JSON.stringify({ ignored: true }),
      JSON.stringify({ e: "c", t: "🌍" }),
      JSON.stringify({ e: "r", t: "private thought" }),
      JSON.stringify({ event: "completion", data: { status: "completed" } }),
    ].join("\n");
    const issues: AgentProtocolIssue[] = [];
    const events: string[] = [];
    const chunks: string[] = [];
    const completed = vi.fn();

    const result = await consumeAgentStream(
      byteStream(splitInsideUtf8(wire, "🌍")),
      {
        onEvent: (event) => events.push(event.event),
        onChunk: (text) => chunks.push(text),
        onComplete: completed,
        onProtocolIssue: (issue) => issues.push(issue),
      },
    );

    expect(result).toEqual({ status: "complete", output: "Hello 🌍" });
    expect(chunks).toEqual(["Hello ", "🌍"]);
    expect(events).toEqual(["chunk", "chunk", "reasoning_chunk", "completion"]);
    expect(issues.map((issue) => issue.kind)).toEqual(["malformed", "unknown"]);
    expect(completed).toHaveBeenCalledOnce();
    expect(completed).toHaveBeenCalledWith("Hello 🌍");
  });

  it("keeps a server error terminal and visible", async () => {
    const onServerError = vi.fn();
    const result = await consumeAgentStream(
      byteStream([
        new TextEncoder().encode(
          `${JSON.stringify({ event: "chunk", data: { text: "partial" } })}\n` +
            JSON.stringify({ event: "error", data: { user_message: "Try again" } }),
        ),
      ]),
      { onServerError },
    );

    expect(result).toEqual({ status: "error", output: "partial", error: "Try again" });
    expect(onServerError).toHaveBeenCalledWith("Try again");
  });

  it("delivers framed output before propagating a later transport failure", async () => {
    const chunks: string[] = [];
    let pullCount = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pullCount++ === 0) {
          controller.enqueue(
          new TextEncoder().encode(
            `${JSON.stringify({ event: "chunk", data: { text: "saved" } })}\n`,
          ),
          );
          return;
        }
        controller.error(new Error("socket lost"));
      },
    });

    await expect(
      consumeAgentStream(body, { onChunk: (text) => chunks.push(text) }),
    ).rejects.toThrow("socket lost");
    expect(chunks).toEqual(["saved"]);
  });
});
