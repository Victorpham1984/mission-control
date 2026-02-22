"use client";
import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { formatDocType } from "@/lib/utils/format";

interface SearchResult {
  documentId: string;
  title: string;
  type: string;
  matchedSnippet: string;
  relevanceScore: number;
}

interface WorkspaceDocumentSearchProps {
  workspaceId: string;
  onSelect?: (documentId: string) => void;
}

export default function WorkspaceDocumentSearch({ workspaceId, onSelect }: WorkspaceDocumentSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchMutation = useMutation({
    mutationFn: (q: string) =>
      fetch(`/api/v1/workspace/documents/search?workspace_id=${workspaceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, limit: 5 }),
      }).then(r => r.json()).then(d => d.results || []),
    onSuccess: (data) => {
      setResults(data);
      setShowDropdown(true);
    },
  });

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length >= 2) {
      debounceRef.current = setTimeout(() => searchMutation.mutate(query), 400);
    } else {
      setResults(null);
      setShowDropdown(false);
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const getRelevanceColor = (score: number) => {
    if (score >= 0.8) return "text-green-400";
    if (score >= 0.6) return "text-blue-400";
    if (score >= 0.4) return "text-yellow-400";
    return "text-[var(--text-dim)]";
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]">🔍</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results && setShowDropdown(true)}
          placeholder="Semantic search (e.g., 'brand colors')"
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]"
        />
        {searchMutation.isPending && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[var(--text-dim)] border-t-[var(--accent)] rounded-full animate-spin" />
        )}
      </div>

      {/* Results Dropdown */}
      {showDropdown && results && (
        <div className="absolute z-50 top-full mt-2 w-full bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden animate-modal">
          {results.length === 0 ? (
            <div className="p-4 text-center text-sm text-[var(--text-dim)]">No results found</div>
          ) : (
            results.map((result) => (
              <div
                key={result.documentId}
                className="relative"
                onMouseEnter={() => setHoveredId(result.documentId)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <button
                  onClick={() => { onSelect?.(result.documentId); setShowDropdown(false); }}
                  className="w-full text-left p-3 hover:bg-[var(--card-hover)] transition border-b border-[var(--border)] last:border-0"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm truncate">{result.title}</span>
                    <span className={`text-xs font-mono ${getRelevanceColor(result.relevanceScore)}`}>
                      {Math.round(result.relevanceScore * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-dim)]">{formatDocType(result.type)}</span>
                  </div>
                  <p className="text-xs text-[var(--text-dim)] line-clamp-2">{result.matchedSnippet}</p>
                </button>

                {/* Preview tooltip on hover */}
                {hoveredId === result.documentId && (
                  <div className="absolute left-full top-0 ml-2 w-64 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xl z-50 hidden lg:block">
                    <h4 className="font-medium text-sm mb-2">{result.title}</h4>
                    <p className="text-xs text-[var(--text-dim)] leading-relaxed">{result.matchedSnippet}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
