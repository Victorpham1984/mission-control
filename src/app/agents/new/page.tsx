"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";

const EMOJI_OPTIONS = ["🤖", "🧠", "⚡", "🎯", "🔧", "📊", "🎨", "🛡️", "🔍", "📝", "🚀", "💡"];

export default function NewAgentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [emoji, setEmoji] = useState("🤖");
  const [persona, setPersona] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    if (!persona.trim() || persona.length < 10) { setError("Persona must be at least 10 characters"); return; }
    
    setSaving(true);
    setError("");
    
    try {
      // First register the agent in the agents table
      const externalId = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
      const regRes = await fetch("/api/v1/agents/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          external_id: externalId,
          type: "ai",
          role: role || undefined,
        }),
      });
      
      if (!regRes.ok) {
        const err = await regRes.json().catch(() => ({}));
        console.error("Register agent error:", err);
        throw new Error(err.error?.message || err.message || "Failed to register agent");
      }
      
      const regData = await regRes.json();
      const agentId = regData.data?.agent_id;

      // Then create the agent profile
      const profRes = await fetch("/api/v1/agents/profiles", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          name,
          persona,
          avatar_url: emoji,
          style_guide: { tone: "professional", emoji_usage: true, language: "en" },
          expertise_areas: role ? [role] : [],
        }),
      });

      if (!profRes.ok) {
        const err = await profRes.json().catch(() => ({}));
        console.error("Create profile error:", err);
        throw new Error(err.error?.message || err.message || "Failed to create agent profile");
      }
      
      router.push("/agents");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => router.back()} className="text-sm text-[var(--text-dim)] hover:text-[var(--text)] mb-4 flex items-center gap-1">
            ← Back to Agents
          </button>
          
          <h1 className="text-xl md:text-2xl font-bold mb-6">Create New Agent</h1>
          
          <div className="space-y-5">
            {/* Emoji picker */}
            <div>
              <label className="text-sm font-medium mb-2 block">Avatar</label>
              <div className="flex gap-2 flex-wrap">
                {EMOJI_OPTIONS.map(e => (
                  <button key={e} onClick={() => setEmoji(e)}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center border transition ${emoji === e ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)] hover:bg-[var(--card)]"}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="text-sm font-medium mb-2 block">Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Research Assistant"
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>

            {/* Role */}
            <div>
              <label className="text-sm font-medium mb-2 block">Role</label>
              <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Specialist, Lead, Integrator"
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>

            {/* Persona */}
            <div>
              <label className="text-sm font-medium mb-2 block">Persona * <span className="text-[var(--text-dim)] font-normal">(min 10 chars)</span></label>
              <textarea value={persona} onChange={e => setPersona(e.target.value)} rows={4}
                placeholder="Describe the agent's personality, behavior, and approach..."
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] resize-none" />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={handleCreate} disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 transition disabled:opacity-50">
                {saving ? "Creating..." : "Create Agent"}
              </button>
              <button onClick={() => router.back()}
                className="px-6 py-2.5 rounded-xl border border-[var(--border)] text-sm hover:bg-[var(--card)] transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
