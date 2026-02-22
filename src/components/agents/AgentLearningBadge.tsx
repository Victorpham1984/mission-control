"use client";

interface AgentLearningBadgeProps {
  learningCount: number;
  hasNewLearning?: boolean;
}

export default function AgentLearningBadge({ learningCount, hasNewLearning = false }: AgentLearningBadgeProps) {
  if (learningCount === 0) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 ${hasNewLearning ? "animate-pulse" : ""}`}
      title={`This agent has learned ${learningCount} thing${learningCount !== 1 ? "s" : ""} from feedback`}
    >
      🧠 {learningCount}
    </span>
  );
}
