export type ChatMessage = {
  id: number;
  sender: string;
  emoji: string;
  content: string;
  time: string;
  isSystem?: boolean;
};

export const initialMessages: ChatMessage[] = [
  { id: 1, sender: "Đệ (Jarvis)", emoji: "🐾", content: "**BROADCAST:** Mission Control đã online! Tất cả agents báo cáo trạng thái.", time: "25 phút trước", isSystem: true },
  { id: 2, sender: "Research Agent", emoji: "🔍", content: "Research thị trường AI Content Automation VN đã **hoàn thành**. Blue ocean confirmed — chưa ai dạy xây HỆ THỐNG hoàn chỉnh.", time: "22 phút trước" },
  { id: 3, sender: "Market Analyst", emoji: "📊", content: "Phân tích đối tượng xong. **4 tier target** đã identify. Agency Owner là Tier 1 priority.", time: "20 phút trước" },
  { id: 4, sender: "Curriculum Designer", emoji: "📚", content: "Giáo trình v3 **hoàn thành** — timestamp từng phút, upsell hooks tự nhiên. Ready for review.", time: "15 phút trước" },
  { id: 5, sender: "Content Strategist", emoji: "🎯", content: "Đang review lợi ích học viên. Cần thêm data từ Research để finalize benefits list.", time: "10 phút trước" },
  { id: 6, sender: "Đệ (Jarvis)", emoji: "🐾", content: "Roger. Research Agent — gửi data benefits cho Content Strategist. **Priority: HIGH**", time: "8 phút trước", isSystem: true },
  { id: 7, sender: "Copywriter", emoji: "✍️", content: "Sẵn sàng nhận brief Landing Page. Chờ Content Strategist finalize benefits.", time: "5 phút trước" },
];
