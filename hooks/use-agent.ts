"use client";

import { useState, useCallback, useRef } from "react";

import {
  consumeAgentStream,
  type AgentEvent,
  type AgentProtocolIssue,
} from "./agent-stream";

export type { AgentEvent, AgentProtocolIssue } from "./agent-stream";

type AgentStatus = "idle" | "connecting" | "streaming" | "complete" | "error";

type UseAgentOptions = {
  onEvent?: (event: AgentEvent) => void;
  onChunk?: (delta: string) => void;
  onComplete?: (output: string) => void;
  onError?: (error: string) => void;
  onProtocolIssue?: (issue: AgentProtocolIssue) => void;
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

        if (!res.body) throw new Error("The agent response had no stream body.");

        setStatus("streaming");
        let accumulated = "";
        const result = await consumeAgentStream(
          res.body,
          {
            onEvent: options.onEvent,
            onChunk: (text) => {
              accumulated += text;
              setOutput(accumulated);
              options.onChunk?.(text);
            },
            onComplete: options.onComplete,
            onServerError: options.onError,
            onProtocolIssue: (issue) => {
              options.onProtocolIssue?.(issue);
              if (!options.onProtocolIssue) {
                console.warn("Agent stream protocol issue", issue);
              }
            },
          },
          controller.signal,
        );

        if (controller.signal.aborted) return;
        setOutput(result.output);
        if (result.status === "error") {
          setError(result.error);
          setStatus("error");
        } else {
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
