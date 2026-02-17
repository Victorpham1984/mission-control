export type Agent = {
  id: string;
  name: string;
  role: string;
  badge: "lead" | "spc" | "int";
  color: string;
  status: "working" | "idle" | "error";
  emoji: string;
};

export type Task = {
  id: number | string;
  title: string;
  desc: string;
  agent: string;
  status: "inbox" | "assigned" | "in-progress" | "review" | "done";
  tags: string[];
  time: string;
  result?: string;
};

export type FeedItem = {
  icon: string;
  text: string;
  time: string;
  task?: string;
};

export const columns = ["inbox", "assigned", "in-progress", "review", "done"] as const;
export const colNames: Record<string, string> = { inbox: "Inbox", assigned: "Assigned", "in-progress": "In Progress", review: "Review", done: "Done" };
export const colColors: Record<string, string> = { inbox: "#94a3b8", assigned: "#fb923c", "in-progress": "#60a5fa", review: "#a78bfa", done: "#4ade80" };
