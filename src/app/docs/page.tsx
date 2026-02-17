"use client";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Header from "@/components/Header";

const DOC_PATH = "/api/docs";

export default function DocsPage() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch(DOC_PATH)
      .then((r) => r.text())
      .then((md) => {
        setContent(md);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Extract headings for sidebar TOC
  const headings = content
    .split("\n")
    .filter((line) => /^#{1,3} /.test(line))
    .map((line) => {
      const level = line.match(/^(#+)/)?.[1].length || 1;
      const text = line.replace(/^#+\s*/, "").replace(/[📋⚡🏗️🔧📊🤖💬📢⚙️🐾🔍📋🚀]/g, "").trim();
      const id = text
        .toLowerCase()
        .replace(/[^a-zA-Z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/g, "")
        .replace(/\s+/g, "-");
      return { level, text, id };
    });

  return (
    <div className="h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      <Header>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden px-2 py-1 rounded text-xs border border-[var(--border)]"
        >
          📑 TOC
        </button>
      </Header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar TOC - Desktop always visible, Mobile toggle */}
        <aside
          className={`${
            sidebarOpen ? "block" : "hidden"
          } md:block w-64 lg:w-72 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] overflow-y-auto p-4`}
        >
          <h3 className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-wider mb-3">
            Mục lục
          </h3>
          <nav className="space-y-0.5">
            {headings.map((h, i) => (
              <a
                key={i}
                href={`#${h.id}`}
                onClick={() => {
                  setActiveSection(h.id);
                  setSidebarOpen(false);
                }}
                className={`block text-sm py-1 transition hover:text-[var(--accent)] ${
                  h.level === 1
                    ? "font-bold text-white"
                    : h.level === 2
                    ? "pl-3 text-[var(--text-dim)]"
                    : "pl-6 text-[var(--text-dim)] text-xs"
                } ${activeSection === h.id ? "text-[var(--accent)]" : ""}`}
              >
                {h.text}
              </a>
            ))}
          </nav>
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 max-w-4xl">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
            </div>
          ) : (
            <article className="docs-content prose prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children, ...props }) => {
                    const id = String(children)
                      .toLowerCase()
                      .replace(/[^a-zA-Z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/g, "")
                      .replace(/\s+/g, "-");
                    return <h1 id={id} className="text-2xl md:text-3xl font-bold mt-8 mb-4 text-white border-b border-[var(--border)] pb-3" {...props}>{children}</h1>;
                  },
                  h2: ({ children, ...props }) => {
                    const id = String(children)
                      .toLowerCase()
                      .replace(/[^a-zA-Z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/g, "")
                      .replace(/\s+/g, "-");
                    return <h2 id={id} className="text-xl md:text-2xl font-bold mt-8 mb-3 text-[var(--accent)]" {...props}>{children}</h2>;
                  },
                  h3: ({ children, ...props }) => {
                    const id = String(children)
                      .toLowerCase()
                      .replace(/[^a-zA-Z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/g, "")
                      .replace(/\s+/g, "-");
                    return <h3 id={id} className="text-lg font-semibold mt-6 mb-2 text-white" {...props}>{children}</h3>;
                  },
                  p: ({ children }) => <p className="text-[var(--text-dim)] leading-relaxed mb-4">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1 text-[var(--text-dim)]">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1 text-[var(--text-dim)]">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  table: ({ children }) => (
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full border-collapse text-sm">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => <th className="border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-left font-semibold text-white">{children}</th>,
                  td: ({ children }) => <td className="border border-[var(--border)] px-3 py-2 text-[var(--text-dim)]">{children}</td>,
                  code: ({ className, children, ...props }) => {
                    const isBlock = className?.includes("language-");
                    if (isBlock) {
                      return (
                        <pre className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 overflow-x-auto mb-4">
                          <code className="text-sm text-green-400" {...props}>{children}</code>
                        </pre>
                      );
                    }
                    return <code className="bg-[var(--card)] px-1.5 py-0.5 rounded text-sm text-[var(--accent)]" {...props}>{children}</code>;
                  },
                  pre: ({ children }) => <>{children}</>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-[var(--accent)] pl-4 my-4 text-[var(--text-dim)] italic">{children}</blockquote>
                  ),
                  hr: () => <hr className="border-[var(--border)] my-8" />,
                  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                  a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">{children}</a>,
                }}
              >
                {content}
              </ReactMarkdown>
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
