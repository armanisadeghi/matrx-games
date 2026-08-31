/**
 * The server-side door to an AI Dream agent run.
 *
 * The PROTOCOL is the package's, not this repo's (`@ai-matrx/agents` 0.6.0,
 * C22 — the hard parts live in the package; hosts inject only identity). This
 * module used to POST a bare `fetch` at a hardcoded `/ai/...` path, which meant
 * it had no connect deadline at all (a hung backend hung this route handler
 * forever), never reached the `/v2` spine, and had nothing to fall back to.
 * `applyAiApiVersion` decides the version and `fetchWithMatrxProtocolFallback`
 * makes reaching for v2 safe by construction: if the v2 endpoint itself is
 * absent or unhealthy, the identical request is retried on v1, loudly, before
 * any stream content is consumed.
 *
 * Identity stays here: the service token and the base URL. The organization
 * rides in the BODY (`organization_id`), which is the sanctioned conversation
 * lane — this is a machine-to-machine service call, not a user-identity call,
 * so it binds no `X-Organization-Id` header.
 */

import {
  applyAiApiVersion,
  fetchWithMatrxProtocolFallback,
  MATRX_AI_API_VERSION_DEFAULT,
} from "@ai-matrx/agents/matrx";

function getBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_MATRX_ENV;
  if (env === "local") return process.env.NEXT_PUBLIC_BACKEND_URL_LOCAL ?? "http://localhost:8000";
  if (env === "dev") return process.env.NEXT_PUBLIC_BACKEND_URL_DEV ?? "";
  if (env === "staging") return process.env.NEXT_PUBLIC_BACKEND_URL_STAGING ?? "";
  if (env === "gpu") return process.env.NEXT_PUBLIC_BACKEND_URL_GPU ?? "";
  return process.env.NEXT_PUBLIC_BACKEND_URL_PROD ?? "https://server.app.matrxserver.com";
}

const AIDREAM_API_TOKEN = process.env.AIDREAM_API_TOKEN;

/**
 * The agent-run path, with the version decided by the package's covered-surface
 * allowlist rather than a literal typed here. Exported so the forcing test can
 * assert the exact path without reaching through `fetch`.
 */
export function agentRunPath(agentId: string): string {
  return applyAiApiVersion(
    `/ai/agents/${encodeURIComponent(agentId)}`,
    MATRX_AI_API_VERSION_DEFAULT,
  );
}

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

  const path = agentRunPath(agentId);

  // `totalTimeoutMs: null` and `throwOnHttpError: false` are PARITY, not
  // taste. The shared transport defaults to a 120s total deadline, which would
  // cut off any agent run longer than two minutes mid-stream; and this
  // function reports a non-2xx by reading the body and throwing its own
  // message, so the transport must hand the response back rather than throw a
  // bare HttpError that loses the server's explanation.
  const { response: res } = await fetchWithMatrxProtocolFallback(
    `${baseUrl}${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AIDREAM_API_TOKEN}`,
      },
      body: JSON.stringify({ stream: true, ...body }),
    },
    {
      totalTimeoutMs: null,
      throwOnHttpError: false,
      onDowngrade: ({ url, reason, status }) => {
        console.warn(
          `[matrx-games] AI v2 endpoint unavailable, retried on v1: ${url}`,
          { reason, status },
        );
      },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AIDream agent error (${res.status}): ${text}`);
  }

  return res;
}
