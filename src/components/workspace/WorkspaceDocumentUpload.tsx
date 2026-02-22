"use client";
import { useState, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/utils/toast";
import { formatBytes, formatDocType, formatDate } from "@/lib/utils/format";

interface WorkspaceDocument {
  id: string;
  title: string;
  type: "brand_guideline" | "product_catalog" | "style_guide" | "other";
  fileSizeBytes: number;
  tags: string[];
  createdAt: string;
  content?: string;
}

interface WorkspaceDocumentUploadProps {
  workspaceId: string;
}

export default function WorkspaceDocumentUpload({ workspaceId }: WorkspaceDocumentUploadProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [docType, setDocType] = useState<string>("brand_guideline");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewDoc, setViewDoc] = useState<WorkspaceDocument | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: documents = [], isLoading } = useQuery<WorkspaceDocument[]>({
    queryKey: ["workspace-documents", workspaceId, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams({ workspace_id: workspaceId });
      if (typeFilter) params.append("type", typeFilter);
      return fetch(`/api/v1/workspace/documents?${params}`).then(r => r.json()).then(d => d.documents || d || []);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (uploadFile: File) => {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("title", uploadFile.name);
      formData.append("type", docType);
      formData.append("workspace_id", workspaceId);
      return fetch("/api/v1/workspace/documents", { method: "POST", body: formData }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-documents"] });
      toast.success("Document uploaded!");
      setUploadOpen(false);
      setFile(null);
    },
    onError: () => toast.error("Upload failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) =>
      fetch(`/api/v1/workspace/documents/${docId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-documents"] });
      toast.success("Document deleted");
      setDeleteConfirm(null);
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setUploadOpen(true);
    }
  }, []);

  const filteredDocuments = documents.filter(doc =>
    !searchQuery || doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSize = documents.reduce((sum, d) => sum + (d.fileSizeBytes || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)]">
        <div className="p-6 border-b border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Workspace Documents</h2>
            <p className="text-sm text-[var(--text-dim)]">{documents.length} documents · {formatBytes(totalSize)} / 50 MB</p>
          </div>
          <button onClick={() => setUploadOpen(true)} className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 transition flex items-center gap-2">
            <span>📤</span> Upload
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-[var(--border)] flex flex-col sm:flex-row gap-3">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[var(--accent)] w-full sm:w-48">
            <option value="">All Types</option>
            <option value="brand_guideline">Brand Guidelines</option>
            <option value="product_catalog">Product Catalogs</option>
            <option value="style_guide">Style Guides</option>
            <option value="other">Other</option>
          </select>
          <input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Drag-drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`mx-4 mt-4 border-2 border-dashed rounded-xl p-6 text-center transition ${dragOver ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)]"}`}
        >
          <p className="text-sm text-[var(--text-dim)]">Drag & drop files here, or <button onClick={() => fileInputRef.current?.click()} className="text-[var(--accent)] hover:underline">browse</button></p>
          <p className="text-xs text-[var(--text-dim)] mt-1">Max 10MB · .txt, .md, .pdf</p>
          <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setUploadOpen(true); } }} />
        </div>

        {/* Document List */}
        <div className="p-4 space-y-2">
          {isLoading ? (
            [1, 2, 3].map(i => <div key={i} className="h-16 bg-[var(--surface)] rounded-xl animate-pulse" />)
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-dim)]">
              <div className="text-4xl mb-3">📄</div>
              <p>No documents found</p>
              <button onClick={() => setUploadOpen(true)} className="text-[var(--accent)] text-sm mt-2 hover:underline">Upload your first document</button>
            </div>
          ) : (
            filteredDocuments.map(doc => (
              <div key={doc.id} className="bg-[var(--surface)] rounded-xl p-4 hover:bg-[var(--card-hover)] transition group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setViewDoc(doc)}>
                    <div className="flex items-center gap-2">
                      <span>📄</span>
                      <h4 className="font-medium truncate">{doc.title}</h4>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-dim)]">
                      <span className="px-2 py-0.5 rounded-full bg-[var(--card)] border border-[var(--border)]">{formatDocType(doc.type)}</span>
                      <span>{formatBytes(doc.fileSizeBytes)}</span>
                      <span>{formatDate(doc.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <button onClick={() => setViewDoc(doc)} className="px-2 py-1 rounded-lg text-xs border border-[var(--border)] hover:bg-[var(--card)]">View</button>
                    <button onClick={() => setDeleteConfirm(doc.id)} className="px-2 py-1 rounded-lg text-xs border border-[var(--border)] hover:bg-red-500/20 text-[var(--red)]">🗑</button>
                  </div>
                </div>
                {deleteConfirm === doc.id && (
                  <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
                    <span className="text-sm">Delete this document?</span>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 rounded text-xs border border-[var(--border)]">Cancel</button>
                      <button onClick={() => deleteMutation.mutate(doc.id)} className="px-2 py-1 rounded text-xs bg-[var(--red)] text-white">Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setUploadOpen(false)}>
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] w-full max-w-md mx-4 animate-modal" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[var(--border)]">
              <h3 className="text-lg font-bold">Upload Document</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Document Type</label>
                <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]">
                  <option value="brand_guideline">Brand Guideline</option>
                  <option value="product_catalog">Product Catalog</option>
                  <option value="style_guide">Style Guide</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">File</label>
                <input type="file" accept=".txt,.md,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-[var(--accent)] file:text-black file:font-medium" />
                {file && <p className="text-xs text-[var(--text-dim)] mt-1">{file.name} · {formatBytes(file.size)}</p>}
              </div>
            </div>
            <div className="p-6 border-t border-[var(--border)] flex justify-end gap-3">
              <button onClick={() => setUploadOpen(false)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm hover:bg-[var(--card-hover)]">Cancel</button>
              <button onClick={() => file && uploadMutation.mutate(file)} disabled={!file || uploadMutation.isPending} className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 disabled:opacity-50 flex items-center gap-2">
                {uploadMutation.isPending && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Document Drawer */}
      {viewDoc && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setViewDoc(null)}>
          <div className="bg-[var(--surface)] w-full max-w-2xl h-full overflow-y-auto animate-modal" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between sticky top-0 bg-[var(--surface)] z-10">
              <h3 className="text-lg font-bold truncate">{viewDoc.title}</h3>
              <button onClick={() => setViewDoc(null)} className="text-[var(--text-dim)] hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6">
              <div className="flex gap-2 mb-4">
                <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--card)] border border-[var(--border)]">{formatDocType(viewDoc.type)}</span>
                <span className="text-xs text-[var(--text-dim)]">{formatBytes(viewDoc.fileSizeBytes)}</span>
              </div>
              <div className="prose prose-invert prose-sm max-w-none">
                {viewDoc.content || <p className="text-[var(--text-dim)] italic">Content preview not available</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
