"use client";

interface TaskQualityScoreProps {
  score: number; // 1-10
  reasoning?: string;
  compact?: boolean;
}

export default function TaskQualityScore({ score, reasoning, compact = false }: TaskQualityScoreProps) {
  const getColor = (s: number) => {
    if (s >= 8) return { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30", ring: "ring-green-500/20" };
    if (s >= 6) return { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30", ring: "ring-blue-500/20" };
    if (s >= 4) return { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30", ring: "ring-yellow-500/20" };
    return { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30", ring: "ring-red-500/20" };
  };

  const getLabel = (s: number) => {
    if (s >= 9) return "Excellent";
    if (s >= 7) return "Good";
    if (s >= 5) return "Average";
    if (s >= 3) return "Below Average";
    return "Poor";
  };

  const colors = getColor(score);
  const pct = (score / 10) * 100;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text} ${colors.border} border`} title={reasoning}>
        <span className="font-bold">{score}</span>/10
      </span>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${colors.border} ${colors.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Quality Score</span>
        <span className={`text-2xl font-bold ${colors.text}`}>{score}<span className="text-sm font-normal text-[var(--text-dim)]">/10</span></span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-[var(--surface)] rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full transition-all duration-500 ${colors.text.replace("text-", "bg-").replace("-400", "-500")}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${colors.text}`}>{getLabel(score)}</span>
        <div className="flex gap-0.5">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className={`w-1.5 h-3 rounded-sm ${i < score ? colors.text.replace("text-", "bg-") : "bg-[var(--border)]"}`} />
          ))}
        </div>
      </div>

      {reasoning && (
        <p className="text-xs text-[var(--text-dim)] mt-3 leading-relaxed">{reasoning}</p>
      )}
    </div>
  );
}
