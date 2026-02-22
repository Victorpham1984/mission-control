"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/utils/toast";
import { formatBytes, formatDocType, formatDate } from "@/lib/utils/format";
import WorkspaceDocumentSearch from "./WorkspaceDocumentSearch";

interface WorkspaceDocument {
  id: string;
  title: string;
  type: string;
  description?: string;
  fileSizeBytes: number;
  embeddingStatus?: "pending" | "processing" | "completed" | "failed";
  createdAt: string;
}

interface WorkspaceDocumentManagerProps {
  workspaceId: string;
}

export default function WorkspaceDocumentManager({ workspaceId }: WorkspaceDocumentManagerProps) {
  const queryClient = useQueryClient();
  const [editingDoc, setEditingDoc] = useState<WorkspaceDocument | null>(null);
  const [editType, setEditType] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: documents = [], isLoading } = useQuery<WorkspaceDocument[]>({
    queryKey: ["workspace-documents-all", workspaceId],
    queryFn: () => fetch(`/api/v1/workspace/documents?workspace_id=${workspaceId}`).then(r => r.json()).then(d => d.documents || d || []),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, type, description }: { id: string; type: string; description: string }) =>
      fetch(`/api/v1/workspace/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, description, workspace_id: workspaceId }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-documents-all"] });
      toast.success("Document updated");
      setEditingDoc(null);
    },
    onError: () => toast.error("Update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) =>
      fetch(`/api/v1/workspace/documents/${docId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-documents-all"] });
      toast.success("Document deleted");
      setDeleteConfirm(null);
    },
  });

  const embeddingStatusColors: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "Pending" },
    processing: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Processing" },
    completed: { bg: "bg-green-500/20", text: "text-green-400", label: "Embedded" },
    failed: { bg: "bg-red-500/20", text: "text-red-400", label: "Failed" },
  };

  const startEdit = (doc: WorkspaceDocument) => {
    setEditingDoc(doc);
    setEditType(doc.type);
    setEditDesc(doc.description || "");
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <WorkspaceDocumentSearch workspaceId={workspaceId} />

      {/* Grid */}
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)]">
        <div className="p-6 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold">Document Manager</h2>
          <p className="text-sm text-[var(--text-dim)]">{documents.length} documents</p>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => <div key={i} className="h-40 bg-[var(--surface)] rounded-xl animate-pulse" />)}
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-dim)]">
              <div className="text-4xl mb-3">📁</div>
              <p>No documents uploaded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {documents.map(doc => (
                <div key={doc.id} className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 hover:border-[var(--accent)]/30 transition group">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-3xl">📄</div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => startEdit(doc)} className="px-2 py-1 rounded text-xs border border-[var(--border)] hover:bg-[var(--card)]" title="Edit">✏️</button>
                      <button onClick={() => setDeleteConfirm(doc.id)} className="px-2 py-1 rounded text-xs border border-[var(--border)] hover:bg-red-500/20" title="Delete">🗑</button>
                    </div>
                  </div>

                  {/* Title */}
                  <h4 className="font-medium text-sm truncate mb-1">{doc.title}</h4>
                  {doc.description && <p className="text-xs text-[var(--text-dim)] line-clamp-2 mb-2">{doc.description}</p>}

                  {/* Meta */}
                  <div className="flex flex-wrap gap-1.5 mt-auto">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--card)] border border-[var(--border)]">{formatDocType(doc.type)}</span>
                    <span className="text-xs text-[var(--text-dim)]">{formatBytes(doc.fileSizeBytes)}</span>
                  </div>

                  {/* Embedding Status */}
                  {doc.embeddingStatus && (
                    <div className="mt-2">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${embeddingStatusColors[doc.embeddingStatus]?.bg} ${embeddingStatusColors[doc.embeddingStatus]?.text}`}>
                        {doc.embeddingStatus === "processing" && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
                        {embeddingStatusColors[doc.embeddingStatus]?.label}
                      </span>
                    </div>
                  )}

                  <div className="text-xs text-[var(--text-dim)] mt-2">{formatDate(doc.createdAt)}</div>

                  {/* Delete Confirmation */}
                  {deleteConfirm === doc.id && (
                    <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-xs mb-2">Delete this document?</p>
                      <div className="flex gap-1">
                        <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-2 py-1 rounded text-xs border border-[var(--border)]">Cancel</button>
                        <button onClick={() => deleteMutation.mutate(doc.id)} className="flex-1 px-2 py-1 rounded text-xs bg-[var(--red)] text-white">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditingDoc(null)}>
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] w-full max-w-md mx-4 animate-modal" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[var(--border)]">
              <h3 className="text-lg font-bold">Edit Document</h3>
              <p className="text-sm text-[var(--text-dim)]">{editingDoc.title}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Document Type</label>
                <select value={editType} onChange={e => setEditType(e.target.value)} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]">
                  <option value="brand_guideline">Brand Guideline</option>
                  <option value="product_catalog">Product Catalog</option>
                  <option value="style_guide">Style Guide</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] resize-y" placeholder="Brief description..." />
              </div>
            </div>
            <div className="p-6 border-t border-[var(--border)] flex justify-end gap-3">
              <button onClick={() => setEditingDoc(null)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm hover:bg-[var(--card-hover)]">Cancel</button>
              <button onClick={() => updateMutation.mutate({ id: editingDoc.id, type: editType, description: editDesc })} disabled={updateMutation.isPending} className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 disabled:opacity-50">
                {updateMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
