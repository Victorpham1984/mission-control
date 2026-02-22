"use client";
import { useQuery } from "@tanstack/react-query";

interface AgentContextPreviewProps {
  agentId: string;
  workspaceId: string;
}

interface ContextData {
  persona: string;
  styleGuide: { tone: string; language: string; emojiUsage: boolean };
  expertiseAreas: string[];
  relevantDocs: Array<{ id: string; title: string; type: string; snippet: string; relevanceScore: number }>;
  totalTokens: number;
}

export default function AgentContextPreview({ agentId, workspaceId }: AgentContextPreviewProps) {
  const { data: context, isLoading } = useQuery<ContextData>({
    queryKey: ["agent-context", agentId, workspaceId],
    queryFn: () =>
      fetch(`/api/v1/agents/${agentId}/context?workspace_id=${workspaceId}`).then(r => r.json()),
  });

  if (isLoading) {
    return (
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6 animate-pulse">
        <div className="h-5 bg-[var(--border)] rounded w-40 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-[var(--border)] rounded" />)}
        </div>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6 text-center text-[var(--text-dim)]">
        <p>Unable to load agent context</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)]">
      <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">👁️ Preview: What Agent Sees</h2>
          <p className="text-sm text-[var(--text-dim)]">Combined context sent to the agent</p>
        </div>
        {context.totalTokens > 0 && (
          <span className="text-xs px-2 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-dim)]">
            ~{context.totalTokens.toLocaleString()} tokens
          </span>
        )}
      </div>

      <div className="p-6 space-y-5">
        {/* Persona */}
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">🎭 Persona</h3>
          <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
            <pre className="text-sm whitespace-pre-wrap font-mono text-[var(--text-dim)] leading-relaxed">{context.persona || "No persona defined"}</pre>
          </div>
        </div>

        {/* Style Guide */}
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">📐 Style Guide</h3>
          <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)] flex flex-wrap gap-3">
            <span className="text-xs px-2 py-1 rounded-full bg-[var(--card)] border border-[var(--border)]">Tone: {context.styleGuide?.tone || "N/A"}</span>
            <span className="text-xs px-2 py-1 rounded-full bg-[var(--card)] border border-[var(--border)]">Language: {context.styleGuide?.language || "N/A"}</span>
            <span className="text-xs px-2 py-1 rounded-full bg-[var(--card)] border border-[var(--border)]">Emoji: {context.styleGuide?.emojiUsage ? "Yes" : "No"}</span>
          </div>
        </div>

        {/* Expertise */}
        {context.expertiseAreas && context.expertiseAreas.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">🎯 Expertise</h3>
            <div className="flex flex-wrap gap-2">
              {context.expertiseAreas.map((area, i) => (
                <span key={i} className="text-xs px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">{area}</span>
              ))}
            </div>
          </div>
        )}

        {/* Relevant Documents */}
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">📄 Relevant Documents ({context.relevantDocs?.length || 0})</h3>
          {context.relevantDocs && context.relevantDocs.length > 0 ? (
            <div className="space-y-2">
              {context.relevantDocs.map(doc => (
                <div key={doc.id} className="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{doc.title}</span>
                    <span className="text-xs text-[var(--text-dim)]">{Math.round(doc.relevanceScore * 100)}% match</span>
                  </div>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--card)] text-[var(--text-dim)]">{doc.type}</span>
                  <p className="text-xs text-[var(--text-dim)] mt-2 line-clamp-2">{doc.snippet}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)] text-center text-sm text-[var(--text-dim)]">
              No workspace documents linked
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
