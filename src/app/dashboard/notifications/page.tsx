"use client";
import Header from "@/components/Header";
import { useNotifications } from "@/hooks/usePlaybooks";

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const channelIcon: Record<string, string> = {
  telegram: "📱",
  dashboard: "📊",
  email: "📧",
};

const statusBadge: Record<string, string> = {
  sent: "bg-emerald-500/20 text-emerald-400",
  failed: "bg-red-500/20 text-red-400",
  pending: "bg-amber-500/20 text-amber-400",
};

export default function NotificationsPage() {
  const { data: notifications, isLoading } = useNotifications();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Notifications</h1>

        {isLoading && (
          <div className="text-center text-[var(--text-dim)] py-12">Loading...</div>
        )}

        {!isLoading && (!notifications || notifications.length === 0) && (
          <div className="text-center text-[var(--text-dim)] py-12">
            <p className="text-lg mb-2">No notifications yet</p>
            <p className="text-sm">Notifications appear when tasks complete, need approval, or fail.</p>
          </div>
        )}

        <div className="space-y-2">
          {notifications?.map((n) => (
            <div
              key={n.id}
              className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg shrink-0">
                    {channelIcon[n.channel] || "🔔"}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm truncate">
                      {n.message || "Notification"}
                    </div>
                    <div className="flex gap-2 mt-1 text-xs text-[var(--text-dim)]">
                      <span className="capitalize">{n.channel}</span>
                      <span className={`px-1.5 py-0.5 rounded ${statusBadge[n.status] || "bg-slate-500/20 text-slate-400"}`}>
                        {n.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-[var(--text-dim)] shrink-0 ml-2">
                  {formatTime(n.sent_at || n.created_at)}
                </div>
              </div>
              {n.error && (
                <div className="mt-2 text-xs text-red-400 truncate">
                  Error: {n.error}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
