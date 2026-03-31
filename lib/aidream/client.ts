function getBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_MATRX_ENV;
  if (env === "local") return process.env.NEXT_PUBLIC_BACKEND_URL_LOCAL ?? "http://localhost:8000";
  if (env === "dev") return process.env.NEXT_PUBLIC_BACKEND_URL_DEV ?? "";
  if (env === "staging") return process.env.NEXT_PUBLIC_BACKEND_URL_STAGING ?? "";
  if (env === "gpu") return process.env.NEXT_PUBLIC_BACKEND_URL_GPU ?? "";
  return process.env.NEXT_PUBLIC_BACKEND_URL_PROD ?? "https://server.app.matrxserver.com";
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

  const res = await fetch(`${baseUrl}/ai/agents/${agentId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AIDREAM_API_TOKEN}`,
    },
    body: JSON.stringify({ stream: true, ...body }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AIDream agent error (${res.status}): ${text}`);
  }

  return res;
}
