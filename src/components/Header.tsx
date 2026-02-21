"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/hooks";

const navItems = [
  { key: "/", label: "Dashboard", emoji: "📊" },
  { key: "/dashboard/approvals", label: "Approvals", emoji: "✅" },
  { key: "/agents", label: "Agents", emoji: "🤖" },
  { key: "/chat/live", label: "Live Chat", emoji: "💬" },
  { key: "/sessions", label: "Sessions", emoji: "📋" },
  { key: "/cron", label: "Cron", emoji: "⏰" },
  { key: "/hooks", label: "Hooks", emoji: "🪝" },
  { key: "/routing", label: "Routing", emoji: "🔀" },
  { key: "/settings", label: "Settings", emoji: "⚙️" },
];

export default function Header({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ email?: string; name: string } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({
          email: user.email,
          name: user.user_metadata?.full_name || user.email?.split("@")[0] || "",
        });
      }
    });
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <header className="shrink-0 h-14 md:h-16 bg-[var(--surface)] border-b border-[var(--border)] flex items-center px-3 md:px-6 gap-2 md:gap-6 z-30">
      <div className="text-base md:text-lg font-bold text-[var(--accent)] flex items-center gap-2 shrink-0">
        <span className="text-xl md:text-2xl">⚡</span>
        <span className="hidden sm:inline">CommandMate</span>
        <span className="sm:hidden">CM</span>
      </div>

      {/* Desktop nav */}
      <nav className="hidden md:flex gap-1 ml-4">
        {navItems.map(item => (
          <button
            key={item.key}
            onClick={() => router.push(item.key)}
            className={`px-4 py-1.5 rounded-lg text-sm transition ${
              pathname === item.key
                ? "bg-[var(--card)] text-white font-semibold border border-[var(--border)]"
                : "text-[var(--text-dim)] hover:bg-[var(--card)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Mobile nav */}
      <div className="flex md:hidden gap-1 ml-2 overflow-x-auto scrollbar-hide">
        {navItems.map(item => (
          <button
            key={item.key}
            onClick={() => router.push(item.key)}
            className={`px-2 py-1 rounded text-xs shrink-0 ${
              pathname === item.key
                ? "bg-[var(--card)] border border-[var(--border)]"
                : "text-[var(--text-dim)]"
            }`}
          >
            {item.emoji}
          </button>
        ))}
      </div>

      <div className="ml-auto flex gap-1 md:gap-2">
        {children}
        {user && (
          <div className="relative" ref={userMenuRef}>
            <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="w-8 h-8 rounded-full bg-[var(--accent)] text-black font-bold text-sm flex items-center justify-center hover:brightness-110 transition" title={user.email}>
              {user.name.charAt(0).toUpperCase()}
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-10 w-56 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl z-50 animate-modal overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <div className="text-sm font-semibold truncate">{user.name}</div>
                  <div className="text-xs text-[var(--text-dim)] truncate">{user.email}</div>
                </div>
                <a href="/settings" className="block px-4 py-2.5 text-sm hover:bg-[var(--card)] transition">⚙️ Settings</a>
                <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--card)] transition text-red-400">🚪 Logout</button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
