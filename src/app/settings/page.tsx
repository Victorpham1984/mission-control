"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [wsName, setWsName] = useState("");
  const [gwUrl, setGwUrl] = useState("");
  const [gwToken, setGwToken] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);
      setName(user.user_metadata?.full_name || "");

      // Load workspace
      const { data: ws } = await supabase
        .from("workspaces")
        .select("*")
        .eq("owner_id", user.id)
        .limit(1)
        .single();

      if (ws) {
        setWorkspaceId(ws.id);
        setWsName(ws.name || "");
        setGwUrl(ws.settings?.gateway_url || "");
        setGwToken(ws.settings?.gateway_token || "");
      }
    };
    load();
  }, [router, supabase]);

  const handleSaveProfile = async () => {
    if (!user) return;
    await supabase.auth.updateUser({
      data: { full_name: name },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveWorkspace = async () => {
    if (!user) return;
    const settings = { gateway_url: gwUrl || null, gateway_token: gwToken || null };

    if (workspaceId) {
      await supabase
        .from("workspaces")
        .update({ name: wsName, settings })
        .eq("id", workspaceId);
    } else {
      const { data } = await supabase
        .from("workspaces")
        .insert({
          name: wsName,
          slug: wsName.toLowerCase().replace(/\s+/g, "-"),
          owner_id: user.id,
          settings,
        })
        .select()
        .single();
      if (data) setWorkspaceId(data.id);
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = async () => {
    if (workspaceId) {
      await supabase.from("workspaces").delete().eq("id", workspaceId);
    }
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2 hover:opacity-80 transition">
              <span className="text-xl">⚡</span>
              <span className="font-bold text-[var(--accent)]">CommandMate</span>
            </a>
            <span className="text-[var(--text-dim)]">/</span>
            <span className="text-sm font-medium">Settings</span>
          </div>
          <a href="/" className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm hover:bg-[var(--card-hover)] transition">
            ← Dashboard
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {saved && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm animate-modal">
            ✓ Changes saved
          </div>
        )}

        {/* Profile */}
        <section className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6">
          <h2 className="text-base font-semibold mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] block mb-1.5">Display Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--accent)] transition"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] block mb-1.5">Email</label>
              <input
                value={user.email || ""}
                disabled
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm opacity-60 cursor-not-allowed"
              />
            </div>
            <button onClick={handleSaveProfile} className="px-4 py-2 rounded-lg bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 transition">
              Save Profile
            </button>
          </div>
        </section>

        {/* Workspace */}
        <section className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6">
          <h2 className="text-base font-semibold mb-4">Workspace</h2>
          <div className="space-y-4">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] block mb-1.5">Workspace Name</label>
              <input
                value={wsName}
                onChange={e => setWsName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--accent)] transition"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] block mb-1.5">OpenClaw Gateway URL</label>
              <input
                value={gwUrl}
                onChange={e => setGwUrl(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--accent)] transition font-mono"
                placeholder="https://gateway.openclaw.ai"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] block mb-1.5">API Token</label>
              <input
                type="password"
                value={gwToken}
                onChange={e => setGwToken(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--accent)] transition font-mono"
                placeholder="oc_xxxxxxxxxxxxxxxx"
              />
            </div>
            <button onClick={handleSaveWorkspace} className="px-4 py-2 rounded-lg bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 transition">
              Save Workspace
            </button>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="bg-[var(--surface)] rounded-2xl border border-red-500/30 p-6">
          <h2 className="text-base font-semibold text-red-400 mb-2">Danger Zone</h2>
          <p className="text-sm text-[var(--text-dim)] mb-4">Permanently delete your workspace and all associated data.</p>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-4 py-2 rounded-lg border border-red-500/50 text-red-400 text-sm hover:bg-red-500/10 transition"
            >
              Delete Workspace
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition"
              >
                Yes, delete everything
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition"
              >
                Cancel
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
