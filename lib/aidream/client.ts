/**
 * The server-side door to an AI Dream agent run.
 *
 * The PROTOCOL is the package's, not this repo's (`@ai-matrx/agents` 0.6.0,
 * C22 — the hard parts live in the package; hosts inject only identity). This
 * module used to POST a bare `fetch` at a hardcoded `/ai/...` path, which meant
 * it had no connect deadline at all (a hung backend hung this route handler
 * forever), and bypassed the package transport. The transport now owns the
 * canonical agent route, the connect deadline, and streaming lifecycle.
 *
 * Identity stays here: the service token and the base URL. The organization
 * rides in the BODY (`organization_id`), which is the sanctioned conversation
 * lane — this is a machine-to-machine service call, not a user-identity call,
 * so it binds no `X-Organization-Id` header.
 */

import { createMatrxTransport, DEPLOYMENTS } from "@ai-matrx/api";

function getBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_MATRX_ENV;
  if (env === "local") {
    return process.env.NEXT_PUBLIC_BACKEND_URL_LOCAL ?? DEPLOYMENTS.aidream.baseUrl.localhost;
  }
  if (env === "dev") return process.env.NEXT_PUBLIC_BACKEND_URL_DEV ?? "";
  if (env === "staging") return process.env.NEXT_PUBLIC_BACKEND_URL_STAGING ?? "";
  if (env === "gpu") return process.env.NEXT_PUBLIC_BACKEND_URL_GPU ?? "";
  return process.env.NEXT_PUBLIC_BACKEND_URL_PROD ?? DEPLOYMENTS.aidream.baseUrl.production;
}

const AIDREAM_API_TOKEN = process.env.AIDREAM_API_TOKEN;

export type AgentRequest = {
  user_input?: string | Record<string, unknown>[];
  variables?: Record<string, unknown>;
  stream?: boolean;
  context?: Record<string, unknown>;
  organization_id?: string;
  workspace_id?: string;
  project_id?: string;
  task_id?: string;
};

export async function callAgent(
  agentId: string,
  body: AgentRequest,
): Promise<Response> {
  const baseUrl = getBaseUrl();
  if (!baseUrl || !AIDREAM_API_TOKEN) {
    throw new Error("Backend URL and AIDREAM_API_TOKEN must be set");
  }

  // Identity is all this app injects: the base URL and the service token. The
  // transport owns the canonical route, the connect deadline, and an uncapped
  // stream (an agent run can outlive any fixed total).
  const transport = createMatrxTransport({
    baseUrl,
    credentials: {
      get: async () => ({ kind: "service", secret: AIDREAM_API_TOKEN }),
    },
    source: "matrx-games",
  });

  const res = await transport.fetch(`/ai/agents/${encodeURIComponent(agentId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stream: true, ...body }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AIDream agent error (${res.status}): ${text}`);
  }

  return res;
}
