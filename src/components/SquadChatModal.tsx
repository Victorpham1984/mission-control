"use client";
import { useState, useRef, useEffect } from "react";
import { type ChatMessage } from "@/lib/chat-data";

type Props = {
  messages: ChatMessage[];
  onSend: (content: string) => void;
  onClose: () => void;
};

function renderContent(content: string) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function SquadChatModal({ messages, onSend, onClose }: Props) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--surface)] rounded-2xl w-full max-w-[560px] h-[80vh] max-h-[600px] flex flex-col border border-[var(--border)] animate-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">💬</span>
            <h2 className="text-base font-semibold">Squad Chat</h2>
            <span className="text-[11px] text-[var(--text-dim)] bg-[var(--card)] px-2 py-0.5 rounded-full">{messages.length} messages</span>
          </div>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-white text-xl px-2">×</button>
        </div>

        {/* Messages */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.isSystem ? "" : ""}`}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 bg-[var(--card)]">
                {msg.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className={`text-[13px] font-semibold ${msg.isSystem ? "text-[var(--accent)]" : ""}`}>{msg.sender}</span>
                  <span className="text-[10px] text-[var(--text-dim)]">{msg.time}</span>
                </div>
                <div className={`text-sm leading-relaxed ${msg.isSystem ? "bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-lg p-2.5" : "text-[var(--text)]"}`}>
                  {renderContent(msg.content)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[var(--border)] shrink-0">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              className="flex-1 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder-[var(--text-dim)]"
              placeholder="Gửi tin nhắn cho Squad..."
            />
            <button onClick={handleSend} className="px-4 py-2.5 rounded-lg bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 transition shrink-0">
              Gửi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
