"use client";

interface MilestoneCelebrationProps {
  agentName: string;
  milestone: number;
  open: boolean;
  onClose: () => void;
}

export default function MilestoneCelebration({ agentName, milestone, open, onClose }: MilestoneCelebrationProps) {
  if (!open) return null;

  const messages: Record<number, string> = {
    10: "They're getting the hang of your business!",
    50: "Halfway to mastery! Quality should be improving.",
    100: "Expert level! This agent knows your brand inside out.",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] w-full max-w-sm mx-4 p-8 text-center animate-modal" onClick={e => e.stopPropagation()}>
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold mb-3">Milestone Reached!</h2>
        <p className="text-base mb-3">
          <strong>{agentName}</strong> just completed their <strong>{milestone}th task</strong>!
        </p>
        <p className="text-sm text-[var(--text-dim)] mb-6">{messages[milestone] || `${milestone} tasks completed!`}</p>
        <button onClick={onClose} className="px-6 py-2.5 rounded-xl bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 transition">
          Awesome! 🙌
        </button>
      </div>
    </div>
  );
}
