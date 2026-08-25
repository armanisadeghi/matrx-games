import {
  readMatrxNdjsonStream,
  type MatrxNdjsonIssue,
  type MatrxStreamEnvelope,
} from "@ai-matrx/agents/stream/ndjson";

export type AgentEvent = MatrxStreamEnvelope;

export type AgentProtocolIssue =
  | { kind: "malformed"; issue: MatrxNdjsonIssue }
  | { kind: "unknown"; value: unknown };

export type AgentStreamCallbacks = {
  onEvent?: (event: AgentEvent) => void;
  onChunk?: (text: string) => void;
  onComplete?: (output: string) => void;
  onServerError?: (message: string) => void;
  onProtocolIssue?: (issue: AgentProtocolIssue) => void;
};

export type AgentStreamResult =
  | { status: "complete"; output: string }
  | { status: "error"; output: string; error: string };

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textField(value: unknown, ...keys: string[]): string | null {
  const source = record(value);
  if (!source) return null;
  for (const key of keys) {
    const candidate = source[key];
    if (typeof candidate === "string") return candidate;
  }
  return null;
}

export async function consumeAgentStream(
  body: ReadableStream<Uint8Array>,
  callbacks: AgentStreamCallbacks = {},
  signal?: AbortSignal,
): Promise<AgentStreamResult> {
  let output = "";
  let completionDelivered = false;
  let serverError: string | null = null;

  for await (const event of readMatrxNdjsonStream(body, {
    ...(signal ? { signal } : {}),
    onMalformedLine: (issue) =>
      callbacks.onProtocolIssue?.({ kind: "malformed", issue }),
    onUnknownEnvelope: (value) =>
      callbacks.onProtocolIssue?.({ kind: "unknown", value }),
  })) {
    callbacks.onEvent?.(event);

    if (event.event === "chunk") {
      const text = textField(event.data, "text", "delta");
      if (text !== null) {
        output += text;
        callbacks.onChunk?.(text);
      }
      continue;
    }

    if (event.event === "completion") {
      output = textField(event.data, "output") ?? output;
      callbacks.onComplete?.(output);
      completionDelivered = true;
      continue;
    }

    if (event.event === "error") {
      serverError = textField(event.data, "message", "user_message") ??
        "The agent stream reported an error.";
      callbacks.onServerError?.(serverError);
    }
  }

  if (serverError !== null) {
    return { status: "error", output, error: serverError };
  }
  if (!completionDelivered && !signal?.aborted) callbacks.onComplete?.(output);
  return { status: "complete", output };
}
