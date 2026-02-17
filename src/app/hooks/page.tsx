"use client";
import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import { invokeOpenClaw } from "@/lib/openclaw";

// ── Types ──────────────────────────────────────────────
interface Hook {
  name: string;
  url?: string;
  endpoint?: string;
  type: string;
  enabled?: boolean;
  lastTriggered?: string;
}

interface WebhookPreset {
  id: string;
  name: string;
  url: string;
  method: string;
  headers: string;
  body: string;
}

interface EventLogEntry {
  id: string;
  timestamp: string;
  hook: string;
  status: number;
  duration?: number;
  summary?: string;
}

// ── Skeleton ───────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-[var(--card)] rounded ${className}`} />;
}

// ── Toast ──────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-4 right-4 bg-[var(--accent)] text-black px-4 py-2 rounded-lg shadow-xl text-sm font-medium z-50 animate-modal">
      {message}
    </div>
  );
}

export default function HooksPage() {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"hooks" | "actions" | "console" | "log">("hooks");
  const [toast, setToast] = useState("");
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);

  // Quick Actions state
  const [wakeText, setWakeText] = useState("");
  const [wakeMode, setWakeMode] = useState<"now" | "next-heartbeat">("now");
  const [taskMessage, setTaskMessage] = useState("");
  const [taskAgentId, setTaskAgentId] = useState("");
  const [taskModel, setTaskModel] = useState("");
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Console state
  const [consoleUrl, setConsoleUrl] = useState("");
  const [consoleMethod, setConsoleMethod] = useState("POST");
  const [consoleHeaders, setConsoleHeaders] = useState('{"Content-Type": "application/json"}');
  const [consoleBody, setConsoleBody] = useState("{}");
  const [consoleResult, setConsoleResult] = useState<{ status?: number; headers?: Record<string, string>; body?: string } | null>(null);
  const [consoleSending, setConsoleSending] = useState(false);
  const [presets, setPresets] = useState<WebhookPreset[]>([]);

  const fetchHooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await invokeOpenClaw("gateway", "config.get", {});
      const cfg = res?.result || res?.data || res || {};
      const hooksData = cfg.hooks || cfg.webhooks || {};
      const parsed: Hook[] = [];

      if (hooksData.wake) {
        parsed.push({ name: "Wake Agent", url: "/hooks/wake", type: "wake", enabled: true, endpoint: hooksData.wake.endpoint || "/hooks/wake" });
      }
      if (hooksData.agent) {
        parsed.push({ name: "Agent Task", url: "/hooks/agent", type: "agent", enabled: true, endpoint: hooksData.agent.endpoint || "/hooks/agent" });
      }
      // Handle array or object of custom hooks
      if (Array.isArray(hooksData.custom)) {
        hooksData.custom.forEach((h: Record<string, unknown>, i: number) => {
          parsed.push({ name: (h.name as string) || `Custom ${i + 1}`, url: (h.url as string) || "", type: "custom", enabled: h.enabled !== false });
        });
      } else if (typeof hooksData === "object") {
        Object.entries(hooksData).forEach(([key, val]) => {
          if (key !== "wake" && key !== "agent" && key !== "custom") {
            const v = val as Record<string, unknown>;
            parsed.push({ name: key, url: (v.url as string) || (v.endpoint as string) || "", type: (v.type as string) || "custom", enabled: v.enabled !== false });
          }
        });
      }

      if (parsed.length === 0) {
        // Always show default hooks
        parsed.push({ name: "Wake Agent", url: "/hooks/wake", type: "wake", enabled: true });
        parsed.push({ name: "Agent Task", url: "/hooks/agent", type: "agent", enabled: true });
      }

      setHooks(parsed);
    } catch {
      setHooks([
        { name: "Wake Agent", url: "/hooks/wake", type: "wake", enabled: true },
        { name: "Agent Task", url: "/hooks/agent", type: "agent", enabled: true },
      ]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHooks();
    // Load presets from localStorage
    try {
      const saved = localStorage.getItem("webhook-presets");
      if (saved) setPresets(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [fetchHooks]);

  const addLogEntry = (hook: string, status: number, duration?: number, summary?: string) => {
    setEventLog(prev => [{
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      hook, status, duration, summary,
    }, ...prev].slice(0, 50));
  };

  // Quick Actions
  const handleWake = async () => {
    setActionLoading(true);
    setActionResult(null);
    const start = Date.now();
    try {
      const res = await fetch("/api/openclaw/hook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "wake", text: wakeText, mode: wakeMode }),
      });
      const data = await res.json();
      const dur = Date.now() - start;
      setActionResult(JSON.stringify(data, null, 2));
      addLogEntry("Wake Agent", res.status, dur, wakeText || "wake");
      setToast("Wake hook sent!");
    } catch (e) {
      setActionResult(`Error: ${e}`);
    }
    setActionLoading(false);
  };

  const handleAgentTask = async () => {
    setActionLoading(true);
    setActionResult(null);
    const start = Date.now();
    try {
      const res = await fetch("/api/openclaw/hook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "agent", message: taskMessage, agentId: taskAgentId || undefined, model: taskModel || undefined }),
      });
      const data = await res.json();
      const dur = Date.now() - start;
      setActionResult(JSON.stringify(data, null, 2));
      addLogEntry("Agent Task", res.status, dur, taskMessage.slice(0, 60));
      setToast("Agent task sent!");
    } catch (e) {
      setActionResult(`Error: ${e}`);
    }
    setActionLoading(false);
  };

  // Console
  const handleConsoleSend = async () => {
    setConsoleSending(true);
    setConsoleResult(null);
    const start = Date.now();
    try {
      let headers: Record<string, string> = {};
      try { headers = JSON.parse(consoleHeaders); } catch { /* ignore */ }
      const opts: RequestInit = { method: consoleMethod, headers };
      if (consoleMethod !== "GET" && consoleMethod !== "HEAD") {
        opts.body = consoleBody;
      }
      const res = await fetch(consoleUrl, opts);
      const dur = Date.now() - start;
      const respHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { respHeaders[k] = v; });
      let body: string;
      try { body = JSON.stringify(await res.json(), null, 2); } catch { body = await res.text(); }
      setConsoleResult({ status: res.status, headers: respHeaders, body });
      addLogEntry(consoleUrl, res.status, dur);
      setToast(`Response: ${res.status}`);
    } catch (e) {
      setConsoleResult({ status: 0, body: `Error: ${e}` });
    }
    setConsoleSending(false);
  };

  const savePreset = () => {
    const name = prompt("Preset name:");
    if (!name) return;
    const newPreset: WebhookPreset = { id: Date.now().toString(), name, url: consoleUrl, method: consoleMethod, headers: consoleHeaders, body: consoleBody };
    const updated = [...presets, newPreset];
    setPresets(updated);
    localStorage.setItem("webhook-presets", JSON.stringify(updated));
    setToast("Preset saved!");
  };

  const loadPreset = (p: WebhookPreset) => {
    setConsoleUrl(p.url);
    setConsoleMethod(p.method);
    setConsoleHeaders(p.headers);
    setConsoleBody(p.body);
    setToast(`Loaded: ${p.name}`);
  };

  const deletePreset = (id: string) => {
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    localStorage.setItem("webhook-presets", JSON.stringify(updated));
  };

  const tabs = [
    { key: "hooks" as const, label: "Active Hooks", emoji: "🪝" },
    { key: "actions" as const, label: "Quick Actions", emoji: "⚡" },
    { key: "console" as const, label: "Test Console", emoji: "🧪" },
    { key: "log" as const, label: "Event Log", emoji: "📜" },
  ];

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      wake: "bg-blue-500/20 text-blue-400",
      agent: "bg-purple-500/20 text-purple-400",
      custom: "bg-amber-500/20 text-amber-400",
    };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[type] || colors.custom}`}>{type}</span>;
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--bg)]">
      <Header />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">🪝 Webhook & Hook Manager</h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-[var(--surface)] p-1 rounded-xl border border-[var(--border)] overflow-x-auto">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${tab === t.key ? "bg-[var(--card)] text-white border border-[var(--border)]" : "text-[var(--text-dim)] hover:text-white"}`}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>

          {/* Active Hooks */}
          {tab === "hooks" && (
            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
              ) : hooks.length === 0 ? (
                <div className="text-center text-[var(--text-dim)] py-12">No hooks configured</div>
              ) : (
                hooks.map((h, i) => (
                  <div key={i} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${h.enabled ? "bg-green-400" : "bg-gray-500"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{h.name}</span>
                        {typeBadge(h.type)}
                      </div>
                      <div className="text-xs text-[var(--text-dim)] truncate mt-1">{h.url || h.endpoint || "—"}</div>
                    </div>
                    <div className="text-xs text-[var(--text-dim)] shrink-0">
                      {h.lastTriggered ? new Date(h.lastTriggered).toLocaleString() : "Never triggered"}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Quick Actions */}
          {tab === "actions" && (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Wake Agent */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">⚡ Wake Agent</h3>
                <input value={wakeText} onChange={e => setWakeText(e.target.value)} placeholder="Wake text (optional)"
                  className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  {(["now", "next-heartbeat"] as const).map(m => (
                    <button key={m} onClick={() => setWakeMode(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${wakeMode === m ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-[var(--card)] text-[var(--text-dim)] border border-[var(--border)]"}`}>
                      {m}
                    </button>
                  ))}
                </div>
                <button onClick={handleWake} disabled={actionLoading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50">
                  {actionLoading ? "Sending..." : "Send Wake Hook"}
                </button>
              </div>

              {/* Agent Task */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">🤖 Run Agent Task</h3>
                <textarea value={taskMessage} onChange={e => setTaskMessage(e.target.value)} placeholder="Message / task description" rows={2}
                  className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm resize-none" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={taskAgentId} onChange={e => setTaskAgentId(e.target.value)} placeholder="Agent ID (optional)"
                    className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" />
                  <input value={taskModel} onChange={e => setTaskModel(e.target.value)} placeholder="Model (optional)"
                    className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" />
                </div>
                <button onClick={handleAgentTask} disabled={actionLoading || !taskMessage}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50">
                  {actionLoading ? "Sending..." : "Run Task"}
                </button>
              </div>

              {/* Response Viewer */}
              {actionResult && (
                <div className="md:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-[var(--text-dim)] mb-2">Response</h4>
                  <pre className="text-xs bg-[var(--card)] rounded-lg p-3 overflow-auto max-h-60 whitespace-pre-wrap">{actionResult}</pre>
                </div>
              )}
            </div>
          )}

          {/* Test Console */}
          {tab === "console" && (
            <div className="space-y-4">
              {/* Presets */}
              {presets.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs text-[var(--text-dim)] self-center">Presets:</span>
                  {presets.map(p => (
                    <div key={p.id} className="flex items-center gap-1 bg-[var(--card)] border border-[var(--border)] rounded-lg px-2 py-1">
                      <button onClick={() => loadPreset(p)} className="text-xs text-[var(--accent)] hover:underline">{p.name}</button>
                      <button onClick={() => deletePreset(p.id)} className="text-xs text-red-400 hover:text-red-300 ml-1">×</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
                <div className="flex gap-2">
                  <select value={consoleMethod} onChange={e => setConsoleMethod(e.target.value)}
                    className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono">
                    {["GET", "POST", "PUT", "PATCH", "DELETE"].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input value={consoleUrl} onChange={e => setConsoleUrl(e.target.value)} placeholder="https://..."
                    className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono" />
                  <button onClick={handleConsoleSend} disabled={consoleSending || !consoleUrl}
                    className="bg-[var(--accent)] text-black px-4 py-2 rounded-lg text-sm font-semibold hover:brightness-110 transition disabled:opacity-50">
                    {consoleSending ? "..." : "Send"}
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[var(--text-dim)] mb-1 block">Headers (JSON)</label>
                    <textarea value={consoleHeaders} onChange={e => setConsoleHeaders(e.target.value)} rows={4}
                      className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs font-mono resize-none" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-dim)] mb-1 block">Body</label>
                    <textarea value={consoleBody} onChange={e => setConsoleBody(e.target.value)} rows={4}
                      className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs font-mono resize-none" />
                  </div>
                </div>

                <button onClick={savePreset} className="text-xs text-[var(--accent)] hover:underline">💾 Save as Preset</button>
              </div>

              {/* Console Result */}
              {consoleResult && (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-mono font-bold ${(consoleResult.status || 0) < 400 ? "text-green-400" : "text-red-400"}`}>
                      {consoleResult.status || "ERR"}
                    </span>
                    <span className="text-xs text-[var(--text-dim)]">Response</span>
                  </div>
                  {consoleResult.headers && (
                    <details className="text-xs">
                      <summary className="text-[var(--text-dim)] cursor-pointer hover:text-white">Headers</summary>
                      <pre className="bg-[var(--card)] rounded-lg p-2 mt-1 overflow-auto max-h-32">{JSON.stringify(consoleResult.headers, null, 2)}</pre>
                    </details>
                  )}
                  <pre className="text-xs bg-[var(--card)] rounded-lg p-3 overflow-auto max-h-60 whitespace-pre-wrap">{consoleResult.body}</pre>
                </div>
              )}
            </div>
          )}

          {/* Event Log */}
          {tab === "log" && (
            <div className="space-y-2">
              {eventLog.length === 0 ? (
                <div className="text-center text-[var(--text-dim)] py-12">No events yet. Use Quick Actions or Test Console to generate events.</div>
              ) : (
                eventLog.map(e => (
                  <div key={e.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 flex items-center gap-3 text-sm">
                    <span className={`font-mono text-xs font-bold ${e.status < 400 ? "text-green-400" : "text-red-400"}`}>{e.status}</span>
                    <span className="font-medium truncate flex-1">{e.hook}</span>
                    {e.duration && <span className="text-xs text-[var(--text-dim)]">{e.duration}ms</span>}
                    <span className="text-xs text-[var(--text-dim)] shrink-0">{new Date(e.timestamp).toLocaleTimeString()}</span>
                    {e.summary && <span className="text-xs text-[var(--text-dim)] truncate max-w-32">{e.summary}</span>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}
