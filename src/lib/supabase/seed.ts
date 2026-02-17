import { createClient } from "./client";

const supabase = createClient();

export async function seedWorkspaceData(workspaceId: string) {
  // Create agents
  const agentDefs = [
    { name: "Market Analyst", description: "Thị trường & Đối thủ", status: "online", config: { role: "Thị trường & Đối thủ", badge: "spc", color: "#e2a04a", emoji: "📊" } },
    { name: "Content Strategist", description: "Chiến lược Content", status: "online", config: { role: "Chiến lược Content", badge: "spc", color: "#a78bfa", emoji: "🎯" } },
    { name: "Copywriter", description: "Copy & Landing Page", status: "offline", config: { role: "Copy & Landing Page", badge: "int", color: "#60a5fa", emoji: "✍️" } },
    { name: "Curriculum Designer", description: "Thiết kế Giáo trình", status: "online", config: { role: "Thiết kế Giáo trình", badge: "spc", color: "#4ade80", emoji: "📚" } },
    { name: "Research Agent", description: "DeepResearch & Data", status: "online", config: { role: "DeepResearch & Data", badge: "int", color: "#fb923c", emoji: "🔍" } },
  ];

  const { data: agents, error: agentError } = await supabase
    .from("agents")
    .insert(agentDefs.map(a => ({ ...a, workspace_id: workspaceId, type: "custom" })))
    .select();

  if (agentError || !agents) {
    console.error("Seed agents error:", agentError);
    return false;
  }

  const agentMap: Record<string, string> = {};
  agents.forEach(a => { agentMap[a.name] = a.id; });

  // Create tasks
  const taskDefs = [
    { agent: "Research Agent", status: "completed", input: { title: "Nghiên cứu thị trường AI Content Automation VN", description: "Phân tích đối thủ, pricing, market gap.", tags: ["research", "market"], kanban_status: "done" }, output: { result: "Blue ocean confirmed — chưa ai dạy xây HỆ THỐNG hoàn chỉnh." } },
    { agent: "Research Agent", status: "completed", input: { title: "Phân tích chiến lược cọc 2M hoàn 100%", description: "Benchmark completion rate, risk analysis.", tags: ["pricing", "strategy"], kanban_status: "done" }, output: { result: "Completion rate dự kiến 40-60%. Đây là LEAD GEN." } },
    { agent: "Curriculum Designer", status: "completed", input: { title: "Giáo trình COSMATE 15 ngày (v3)", description: "Bản chi tiết từng phút, timestamp video & live.", tags: ["curriculum"], kanban_status: "done" }, output: { result: "Bản nâng cấp: timestamp từng phút, upsell hooks tự nhiên." } },
    { agent: "Market Analyst", status: "completed", input: { title: "Phân tích đối tượng mục tiêu", description: "Agency, Solo, CEO SME, Marketer — pain point, WTP.", tags: ["target", "market"], kanban_status: "done" }, output: { result: "Tier 1: Agency Owner — WTP 5-20tr" } },
    { agent: "Content Strategist", status: "running", input: { title: "Lợi ích học viên — Bản tổng hợp", description: "Tổng hợp benefits từ research + curriculum.", tags: ["content", "benefits"], kanban_status: "review" } },
    { agent: "Copywriter", status: "pending", input: { title: "Viết copy Landing Page COSMATE", description: "Hero section, benefits, social proof, CTA, FAQ.", tags: ["copy", "landing-page"], kanban_status: "inbox" } },
    { agent: "Copywriter", status: "pending", input: { title: "Email sequence thu lead", description: "Chuỗi 5 email: welcome → value → case study → urgency → last call.", tags: ["copy", "email"], kanban_status: "inbox" } },
    { agent: "Curriculum Designer", status: "running", input: { title: "Checklist hoàn thành thử thách", description: "Điều kiện hoàn cọc chi tiết 15 ngày.", tags: ["curriculum", "checklist"], kanban_status: "assigned" } },
    { agent: "Content Strategist", status: "pending", input: { title: "Content Marketing Plan", description: "Kế hoạch quảng bá trước khi mở bán.", tags: ["content", "marketing"], kanban_status: "assigned" } },
  ];

  const { error: taskError } = await supabase
    .from("tasks")
    .insert(taskDefs.map(t => ({
      agent_id: agentMap[t.agent],
      workspace_id: workspaceId,
      status: t.status,
      input: t.input,
      output: t.output || null,
    })));

  if (taskError) {
    console.error("Seed tasks error:", taskError);
    return false;
  }

  // Create messages
  const msgDefs = [
    { agent: "Research Agent", content: "Research thị trường AI Content Automation VN đã hoàn thành. Blue ocean confirmed.", direction: "outbound" },
    { agent: "Market Analyst", content: "Phân tích đối tượng xong. 4 tier target đã identify.", direction: "outbound" },
    { agent: "Curriculum Designer", content: "Giáo trình v3 hoàn thành — timestamp từng phút.", direction: "outbound" },
    { agent: "Content Strategist", content: "Đang review lợi ích học viên.", direction: "outbound" },
    { agent: "Copywriter", content: "Sẵn sàng nhận brief Landing Page.", direction: "outbound" },
  ];

  const { error: msgError } = await supabase
    .from("messages")
    .insert(msgDefs.map(m => ({
      agent_id: agentMap[m.agent],
      workspace_id: workspaceId,
      direction: m.direction,
      content: m.content,
      is_broadcast: false,
    })));

  if (msgError) {
    console.error("Seed messages error:", msgError);
    return false;
  }

  return true;
}
