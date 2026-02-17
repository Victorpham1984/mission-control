"use client";
import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import { invokeOpenClaw } from "@/lib/openclaw";

// ── Types ──────────────────────────────────────────────
interface Channel {
  id: string;
  name: string;
  type: string;
  status: "connected" | "disconnected" | "error";
  messageCount?: number;
  config?: Record<string, unknown>;
}

interface Agent {
  id: string;
  name: string;
  status: "online" | "offline" | "busy";
  model?: string;
}

interface Binding {
  channelPattern: string;
  agentId: string;
  sessionTarget?: string;
}

// ── Skeleton ───────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-[var(--card)] rounded ${className}`} />;
}

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

const channelIcons: Record<string, string> = {
  telegram: "📱",
  whatsapp: "💬",
  discord: "🎮",
  slack: "💼",
  webhook: "🪝",
  default: "📡",
};

const statusColors: Record<string, string> = {
  connected: "bg-green-400",
  online: "bg-green-400",
  disconnected: "bg-gray-500",
  offline: "bg-gray-500",
  error: "bg-red-400",
  busy: "bg-amber-400",
};

export default function RoutingPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [rawConfig, setRawConfig] = useState<string>("{}");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"flow" | "channels" | "bindings" | "config">("flow");
  const [toast, setToast] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  const fetchRouting = useCallback(async () => {
    setLoading(true);
    try {
      const res = await invokeOpenClaw("gateway", "config.get", {});
      const cfg = res?.result || res?.data || res || {};
      setRawConfig(JSON.stringify(cfg, null, 2));

      // Parse channels
      const chans: Channel[] = [];
      const channelsCfg = cfg.channels || cfg.channel || {};
      if (typeof channelsCfg === "object") {
        Object.entries(channelsCfg).forEach(([key, val]) => {
          const v = val as Record<string, unknown>;
          chans.push({
            id: key,
            name: (v.name as string) || key,
            type: (v.type as string) || (v.provider as string) || key,
            status: v.enabled === false ? "disconnected" : "connected",
            messageCount: v.messageCount as number | undefined,
            config: v,
          });
        });
      }
      // If no channels from config, show common defaults
      if (chans.length === 0) {
        ["telegram", "discord", "whatsapp"].forEach(t => {
          chans.push({ id: t, name: t.charAt(0).toUpperCase() + t.slice(1), type: t, status: "disconnected" });
        });
      }
      setChannels(chans);

      // Parse agents
      const agentList: Agent[] = [];
      const agentsCfg = cfg.agents || cfg.agent || {};
      if (typeof agentsCfg === "object" && !Array.isArray(agentsCfg)) {
        Object.entries(agentsCfg).forEach(([key, val]) => {
          const v = val as Record<string, unknown>;
          agentList.push({
            id: key,
            name: (v.name as string) || key,
            status: v.enabled === false ? "offline" : "online",
            model: v.model as string | undefined,
          });
        });
      }
      if (agentList.length === 0) {
        agentList.push({ id: "main", name: "Main Agent", status: "online", model: cfg.defaultModel || cfg.model });
      }
      setAgents(agentList);

      // Parse bindings
      const bindList: Binding[] = [];
      const routingCfg = cfg.routing || cfg.bindings || cfg.routes || {};
      if (Array.isArray(routingCfg)) {
        routingCfg.forEach((r: Record<string, unknown>) => {
          bindList.push({
            channelPattern: (r.channel as string) || (r.pattern as string) || "*",
            agentId: (r.agent as string) || (r.agentId as string) || "main",
            sessionTarget: r.session as string | undefined,
          });
        });
      } else if (typeof routingCfg === "object") {
        Object.entries(routingCfg).forEach(([pattern, val]) => {
          const v = typeof val === "string" ? { agentId: val } : (val as Record<string, unknown>);
          bindList.push({
            channelPattern: pattern,
            agentId: (v.agent as string) || (v.agentId as string) || (typeof val === "string" ? val : "main"),
            sessionTarget: v.session as string | undefined,
          });
        });
      }
      // Default binding if none
      if (bindList.length === 0) {
        chans.forEach(c => {
          bindList.push({ channelPattern: c.id, agentId: "main", sessionTarget: "main" });
        });
      }
      setBindings(bindList);
    } catch {
      setChannels([{ id: "telegram", name: "Telegram", type: "telegram", status: "connected" }]);
      setAgents([{ id: "main", name: "Main Agent", status: "online" }]);
      setBindings([{ channelPattern: "*", agentId: "main", sessionTarget: "main" }]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRouting(); }, [fetchRouting]);

  const copyConfig = () => {
    navigator.clipboard.writeText(rawConfig);
    setToast("Config copied!");
  };

  const tabs = [
    { key: "flow" as const, label: "Flow Diagram", emoji: "🔀" },
    { key: "channels" as const, label: "Channels", emoji: "📡" },
    { key: "bindings" as const, label: "Bindings", emoji: "🔗" },
    { key: "config" as const, label: "Config", emoji: "📄" },
  ];

  // Find which agents a channel routes to
  const getAgentForChannel = (channelId: string): string[] => {
    const matched = bindings.filter(b => b.channelPattern === channelId || b.channelPattern === "*");
    return matched.length > 0 ? matched.map(b => b.agentId) : ["main"];
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--bg)]">
      <Header />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold">🔀 Multi-Agent Routing</h1>

          {/* Tabs */}
          <div className="flex gap-1 bg-[var(--surface)] p-1 rounded-xl border border-[var(--border)] overflow-x-auto">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${tab === t.key ? "bg-[var(--card)] text-white border border-[var(--border)]" : "text-[var(--text-dim)] hover:text-white"}`}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : (
            <>
              {/* Flow Diagram */}
              {tab === "flow" && (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 overflow-x-auto">
                  <div className="min-w-[600px]">
                    {/* SVG connectors */}
                    <div className="relative">
                      <div className="grid grid-cols-3 gap-8">
                        {/* Channels Column */}
                        <div className="space-y-3">
                          <h3 className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-3">Channels</h3>
                          {channels.map(c => (
                            <div key={c.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 flex items-center gap-2 relative" id={`ch-${c.id}`}>
                              <span className="text-lg">{channelIcons[c.type] || channelIcons.default}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{c.name}</div>
                                <div className="text-xs text-[var(--text-dim)]">{c.type}</div>
                              </div>
                              <div className={`w-2.5 h-2.5 rounded-full ${statusColors[c.status]}`} />
                              {/* Connector dot right */}
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full bg-[var(--accent)] z-10" />
                            </div>
                          ))}
                        </div>

                        {/* Routing Rules Column */}
                        <div className="space-y-3 flex flex-col justify-center">
                          <h3 className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-3">Routing Rules</h3>
                          {bindings.map((b, i) => (
                            <div key={i} className="bg-[var(--card)] border border-[var(--accent)]/20 rounded-xl p-3 relative">
                              {/* Connector dots */}
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[var(--accent)] z-10" />
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full bg-[var(--accent)] z-10" />
                              <div className="text-xs font-mono text-[var(--accent)]">{b.channelPattern}</div>
                              <div className="text-xs text-[var(--text-dim)] mt-1">→ {b.agentId}{b.sessionTarget ? ` (${b.sessionTarget})` : ""}</div>
                            </div>
                          ))}

                          {/* Visual connector lines using CSS */}
                          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                            <defs>
                              <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" opacity="0.3" />
                              </marker>
                            </defs>
                          </svg>
                        </div>

                        {/* Agents Column */}
                        <div className="space-y-3">
                          <h3 className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-3">Agents</h3>
                          {agents.map(a => (
                            <div key={a.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 flex items-center gap-2 relative">
                              {/* Connector dot left */}
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[var(--accent)] z-10" />
                              <span className="text-lg">🤖</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{a.name}</div>
                                {a.model && <div className="text-xs text-[var(--text-dim)] truncate">{a.model}</div>}
                              </div>
                              <div className={`w-2.5 h-2.5 rounded-full ${statusColors[a.status]}`} />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Horizontal connector lines between columns */}
                      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
                        {channels.map((c, ci) => {
                          const agentIds = getAgentForChannel(c.id);
                          return agentIds.map((aId, ai) => {
                            const agentIdx = agents.findIndex(a => a.id === aId);
                            if (agentIdx === -1) return null;
                            const leftY = 40 + ci * 76 + 30;
                            const rightY = 40 + agentIdx * 76 + 30;
                            return (
                              <svg key={`${ci}-${ai}`} className="absolute inset-0 w-full h-full">
                                <line
                                  x1="33.3%" y1={leftY} x2="66.6%" y2={rightY}
                                  stroke="var(--accent)" strokeOpacity="0.15" strokeWidth="2" strokeDasharray="4 4"
                                />
                              </svg>
                            );
                          });
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Channel Status Cards */}
              {tab === "channels" && (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {channels.map(c => (
                      <button key={c.id} onClick={() => setSelectedChannel(selectedChannel?.id === c.id ? null : c)}
                        className={`bg-[var(--surface)] border rounded-xl p-4 text-left transition hover:border-[var(--accent)]/30 ${selectedChannel?.id === c.id ? "border-[var(--accent)]" : "border-[var(--border)]"}`}>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-2xl">{channelIcons[c.type] || channelIcons.default}</span>
                          <div className="flex-1">
                            <div className="font-semibold">{c.name}</div>
                            <div className="text-xs text-[var(--text-dim)]">{c.type}</div>
                          </div>
                          <div className={`w-3 h-3 rounded-full ${statusColors[c.status]}`} />
                        </div>
                        <div className="flex items-center justify-between text-xs text-[var(--text-dim)]">
                          <span className={`px-2 py-0.5 rounded-full font-medium ${c.status === "connected" ? "bg-green-500/10 text-green-400" : c.status === "error" ? "bg-red-500/10 text-red-400" : "bg-gray-500/10 text-gray-400"}`}>
                            {c.status}
                          </span>
                          {c.messageCount !== undefined && <span>{c.messageCount} msgs today</span>}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Channel Detail */}
                  {selectedChannel && (
                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        {channelIcons[selectedChannel.type] || channelIcons.default} {selectedChannel.name} Config
                      </h3>
                      <pre className="text-xs bg-[var(--card)] rounded-lg p-3 overflow-auto max-h-60">
                        {JSON.stringify(selectedChannel.config || { id: selectedChannel.id, type: selectedChannel.type, status: selectedChannel.status }, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Agent Binding Table */}
              {tab === "bindings" && (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-[var(--text-dim)]">
                          <th className="text-left px-4 py-3 font-medium">Channel Pattern</th>
                          <th className="text-left px-4 py-3 font-medium">Agent ID</th>
                          <th className="text-left px-4 py-3 font-medium">Session Target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bindings.map((b, i) => (
                          <tr key={i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--card)] transition">
                            <td className="px-4 py-3 font-mono text-[var(--accent)]">{b.channelPattern}</td>
                            <td className="px-4 py-3 font-mono">{b.agentId}</td>
                            <td className="px-4 py-3 text-[var(--text-dim)]">{b.sessionTarget || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Config Preview */}
              {tab === "config" && (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Gateway Configuration</h3>
                    <button onClick={copyConfig} className="text-xs bg-[var(--card)] border border-[var(--border)] px-3 py-1.5 rounded-lg hover:border-[var(--accent)]/30 transition">
                      📋 Copy
                    </button>
                  </div>
                  <pre className="text-xs bg-[var(--card)] rounded-lg p-4 overflow-auto max-h-96 whitespace-pre-wrap">{rawConfig}</pre>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}
