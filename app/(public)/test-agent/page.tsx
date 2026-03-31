"use client";

import { useState } from "react";
import { useAgent } from "@/hooks/use-agent";

export default function TestAgentPage() {
  const [agentId, setAgentId] = useState("");
  const [message, setMessage] = useState("");
  const [events, setEvents] = useState<string[]>([]);

  const { run, stop, status, output, error } = useAgent({
    onEvent: (event) => {
      setEvents((prev) => [...prev, JSON.stringify(event, null, 2)]);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agentId.trim() || !message.trim()) return;
    setEvents([]);
    run(agentId.trim(), message.trim());
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Agent Test</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Agent ID</label>
          <input
            type="text"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="e.g. code-reviewer or a UUID"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What do you want to ask the agent?"
            rows={3}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={status === "streaming" || status === "connecting"}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {status === "connecting" ? "Connecting..." : status === "streaming" ? "Streaming..." : "Send"}
          </button>
          {(status === "streaming" || status === "connecting") && (
            <button
              type="button"
              onClick={stop}
              className="rounded-md border px-4 py-2 text-sm font-medium"
            >
              Stop
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">
          Status: <span className="font-mono">{status}</span>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {output && (
          <div className="space-y-1">
            <h2 className="text-sm font-medium">Output</h2>
            <div className="rounded-md border bg-muted/50 p-4 text-sm whitespace-pre-wrap">
              {output}
            </div>
          </div>
        )}

        {events.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Raw events ({events.length})
            </summary>
            <div className="mt-2 max-h-96 overflow-y-auto rounded-md border bg-muted/30 p-3">
              {events.map((e, i) => (
                <pre key={i} className="text-xs mb-2 font-mono border-b border-border/50 pb-2 last:border-0">
                  {e}
                </pre>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
