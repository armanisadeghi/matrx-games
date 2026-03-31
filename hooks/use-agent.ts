"use client";

import { useState, useCallback, useRef } from "react";

export type AgentEvent =
  | { event: "status_update"; data: { status: string; system_message?: string; user_message?: string } }
  | { event: "chunk"; data: { delta: string; tool_use_id?: string | null } }
  | { event: "data"; data: Record<string, unknown> }
  | { event: "completion"; data: { status: string; output?: string; iterations?: number } }
  | { event: "error"; data: { message: string } };

type AgentStatus = "idle" | "connecting" | "streaming" | "complete" | "error";

type UseAgentOptions = {
  onEvent?: (event: AgentEvent) => void;
  onChunk?: (delta: string) => void;
  onComplete?: (output: string) => void;
  onError?: (error: string) => void;
};

export function useAgent(options: UseAgentOptions = {}) {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (agentId: string, userInput: string, extra?: Record<string, unknown>) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("connecting");
      setOutput("");
      setError(null);

      try {
        const res = await fetch(`/api/agents/${agentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_input: userInput, ...extra }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text);
        }

        setStatus("streaming");
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
              const event = JSON.parse(trimmed) as AgentEvent;
              options.onEvent?.(event);

              if (event.event === "chunk") {
                accumulated += event.data.delta;
                setOutput(accumulated);
                options.onChunk?.(event.data.delta);
              } else if (event.event === "completion") {
                const finalOutput = event.data.output ?? accumulated;
                setOutput(finalOutput);
                setStatus("complete");
                options.onComplete?.(finalOutput);
              } else if (event.event === "error") {
                setError(event.data.message);
                setStatus("error");
                options.onError?.(event.data.message);
              }
            } catch {
              // skip malformed lines
            }
          }
        }

        if (status !== "error") {
          setStatus("complete");
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setStatus("error");
        options.onError?.(message);
      }
    },
    [options],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
  }, []);

  return { run, stop, status, output, error };
}
