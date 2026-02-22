"use client";
import { useState } from "react";
import Header from "@/components/Header";
import WorkspaceDocumentUpload from "@/components/workspace/WorkspaceDocumentUpload";
import WorkspaceDocumentManager from "@/components/workspace/WorkspaceDocumentManager";
import { useWorkspaceData } from "@/lib/supabase/hooks";

export default function WorkspaceDocumentsPage() {
  const { workspaceId, loading } = useWorkspaceData();
  const [view, setView] = useState<"upload" | "manage">("upload");

  if (loading) {
    return (
      <div className="h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-4xl animate-pulse">📄</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-[var(--text-dim)] mb-4">
            <a href="/" className="hover:text-white transition">Dashboard</a>
            <span>/</span>
            <span className="text-white">Workspace Documents</span>
          </div>

          {/* View Toggle */}
          <div className="flex gap-1 bg-[var(--surface)] rounded-xl p-1 border border-[var(--border)] mb-6 w-fit">
            <button onClick={() => setView("upload")} className={`px-4 py-2 rounded-lg text-sm transition ${view === "upload" ? "bg-[var(--card)] text-white font-semibold border border-[var(--border)]" : "text-[var(--text-dim)] hover:text-white"}`}>
              📤 Upload & Browse
            </button>
            <button onClick={() => setView("manage")} className={`px-4 py-2 rounded-lg text-sm transition ${view === "manage" ? "bg-[var(--card)] text-white font-semibold border border-[var(--border)]" : "text-[var(--text-dim)] hover:text-white"}`}>
              📁 Manage & Search
            </button>
          </div>

          {view === "upload" ? (
            <WorkspaceDocumentUpload workspaceId={workspaceId || ""} />
          ) : (
            <WorkspaceDocumentManager workspaceId={workspaceId || ""} />
          )}
        </div>
      </main>
    </div>
  );
}
