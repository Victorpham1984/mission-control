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
  id: number;
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

export const agents: Agent[] = [
  { id: "market", name: "Market Analyst", role: "Thị trường & Đối thủ", badge: "spc", color: "#e2a04a", status: "working", emoji: "📊" },
  { id: "content", name: "Content Strategist", role: "Chiến lược Content", badge: "spc", color: "#a78bfa", status: "working", emoji: "🎯" },
  { id: "copy", name: "Copywriter", role: "Copy & Landing Page", badge: "int", color: "#60a5fa", status: "idle", emoji: "✍️" },
  { id: "curriculum", name: "Curriculum Designer", role: "Thiết kế Giáo trình", badge: "spc", color: "#4ade80", status: "working", emoji: "📚" },
  { id: "research", name: "Research Agent", role: "DeepResearch & Data", badge: "int", color: "#fb923c", status: "working", emoji: "🔍" },
];

export const initialTasks: Task[] = [
  { id: 1, title: "Nghiên cứu thị trường AI Content Automation VN", desc: "Phân tích đối thủ, pricing, market gap. Blue ocean confirmed.", agent: "research", status: "done", tags: ["research", "market"], time: "20 phút trước", result: "Chưa ai ở VN dạy xây HỆ THỐNG content automation hoàn chỉnh dạng challenge.\n\nĐối thủ gần nhất: STTTv4 — focus ads+chatbot.\nCase study: Agency tiết kiệm 1-2 nhân sự (15-20M/tháng).\nTarget: Agency Owner (Tier 1), CEO SME (Tier 2).\nMô hình cọc 2M = freemium ngụy trang — win cả 2 chiều." },
  { id: 2, title: "Phân tích chiến lược cọc 2M hoàn 100%", desc: "Benchmark completion rate, risk analysis.", agent: "research", status: "done", tags: ["pricing", "strategy"], time: "20 phút trước", result: "Completion rate dự kiến 40-60%.\n100 người → giữ 80-110tr từ cọc.\nĐây là LEAD GEN, không phải revenue chính.\nUpsell conversion 20-30% từ người hoàn thành." },
  { id: 3, title: "Giáo trình COSMATE 15 ngày (v2)", desc: "Giáo trình chi tiết: chủ đề, video, live, deliverable.", agent: "curriculum", status: "done", tags: ["curriculum"], time: "18 phút trước", result: "Phase 1 (1-3): Nền tảng\nPhase 2 (4-10): Xây module\nPhase 3 (11-14): Tích hợp\nPhase 4 (15): Launch & Graduation\n50+ content pieces sau 15 ngày." },
  { id: 4, title: "Giáo trình COSMATE 15 ngày (v3)", desc: "Bản chi tiết từng phút, timestamp video & live.", agent: "curriculum", status: "done", tags: ["curriculum"], time: "15 phút trước", result: "Bản nâng cấp: timestamp từng phút, Social Post trước (momentum), Ngày 13 YouTube/Website input, Upsell hooks tự nhiên, Graduation Challenge." },
  { id: 5, title: "Phân tích đối tượng mục tiêu", desc: "Agency, Solo, CEO SME, Marketer — pain point, WTP.", agent: "market", status: "done", tags: ["target", "market"], time: "20 phút trước", result: "Tier 1: Agency Owner — WTP 5-20tr\nTier 2: CEO SME — budget dồi dào\nTier 3: Marketer — đông nhất\nTier 4: Solo Creator — dễ viral" },
  { id: 6, title: "Lợi ích học viên — Bản tổng hợp", desc: "Tổng hợp benefits từ research + curriculum.", agent: "content", status: "review", tags: ["content", "benefits"], time: "10 phút trước" },
  { id: 7, title: "Viết copy Landing Page COSMATE", desc: "Hero section, benefits, social proof, CTA, FAQ.", agent: "copy", status: "inbox", tags: ["copy", "landing-page"], time: "Chưa bắt đầu" },
  { id: 8, title: "Email sequence thu lead", desc: "Chuỗi 5 email: welcome → value → case study → urgency → last call.", agent: "copy", status: "inbox", tags: ["copy", "email"], time: "Chưa bắt đầu" },
  { id: 9, title: "Checklist hoàn thành thử thách", desc: "Điều kiện hoàn cọc chi tiết 15 ngày.", agent: "curriculum", status: "assigned", tags: ["curriculum", "checklist"], time: "Mới giao" },
  { id: 10, title: "Chiến lược Webinar miễn phí", desc: "Script webinar demo live hệ thống.", agent: "content", status: "inbox", tags: ["strategy", "webinar"], time: "Chưa bắt đầu" },
  { id: 11, title: "Content Marketing Plan", desc: "Kế hoạch quảng bá trước khi mở bán.", agent: "content", status: "assigned", tags: ["content", "marketing"], time: "Mới giao" },
];

export const initialFeed: FeedItem[] = [
  { icon: "✅", text: "Curriculum Designer hoàn thành Giáo trình v3", time: "15 phút trước", task: "Giáo trình v3" },
  { icon: "✅", text: "Research Agent hoàn thành Nghiên cứu thị trường", time: "20 phút trước", task: "Nghiên cứu thị trường" },
  { icon: "📋", text: "Đệ kiểm duyệt và tổng hợp kết quả", time: "10 phút trước" },
  { icon: "🔄", text: "Content Strategist đang review lợi ích học viên", time: "10 phút trước" },
  { icon: "📌", text: "Đệ giao task: Checklist hoàn thành thử thách", time: "5 phút trước" },
  { icon: "💬", text: "Sếp Victor yêu cầu xây Mission Control", time: "Vừa xong" },
];

export const columns = ["inbox", "assigned", "in-progress", "review", "done"] as const;
export const colNames: Record<string, string> = { inbox: "Inbox", assigned: "Assigned", "in-progress": "In Progress", review: "Review", done: "Done" };
export const colColors: Record<string, string> = { inbox: "#94a3b8", assigned: "#fb923c", "in-progress": "#60a5fa", review: "#a78bfa", done: "#4ade80" };
