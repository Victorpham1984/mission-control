export async function invokeOpenClaw(tool: string, action: string, args?: Record<string, unknown>) {
  const res = await fetch("/api/openclaw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, action, args }),
  });
  return res.json();
}

export async function sendAgentMessage(message: string, agentId?: string) {
  const res = await fetch("/api/openclaw/hook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, agentId }),
  });
  return res.json();
}

export interface Session {
  key: string;
  label?: string;
  model?: string;
  totalTokens?: number;
  lastUpdated?: string;
  type?: string;
}

export interface Message {
  role: string;
  content: string;
  timestamp?: string;
  toolCalls?: unknown[];
  thinking?: string;
  tokens?: number;
}
