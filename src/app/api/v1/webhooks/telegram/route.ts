import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/api/auth";
import { TelegramAdapter } from "@/lib/notifications/telegram-adapter";

// POST /api/v1/webhooks/telegram
// Receives Telegram callback_query updates
export async function POST(req: NextRequest) {
  let update;
  try { update = await req.json(); } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const callbackQuery = update.callback_query;
  if (!callbackQuery) {
    // Not a callback query — ignore (could be /start etc.)
    return NextResponse.json({ ok: true });
  }

  const callbackData = callbackQuery.data as string;
  const chatId = String(callbackQuery.message?.chat?.id);
  const messageId = callbackQuery.message?.message_id as number;
  const callbackQueryId = callbackQuery.id as string;

  if (!callbackData || !chatId || !messageId) {
    return NextResponse.json({ ok: true });
  }

  const supabase = getServiceClient();

  // Parse callback_data: "approve:taskId:rating" or "reject:taskId:action"
  const parts = callbackData.split(":");
  if (parts.length !== 3) {
    await TelegramAdapter.answerCallback(callbackQueryId, "Invalid action");
    return NextResponse.json({ ok: true });
  }

  const [action, taskId, param] = parts;

  // Find workspace from telegram_chat_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("telegram_chat_id", chatId)
    .single();

  if (!profile) {
    await TelegramAdapter.answerCallback(callbackQueryId, "User not linked");
    return NextResponse.json({ ok: true });
  }

  // Get workspace for this user
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", profile.id)
    .limit(1)
    .single();

  if (!workspace) {
    await TelegramAdapter.answerCallback(callbackQueryId, "No workspace found");
    return NextResponse.json({ ok: true });
  }

  // Verify task belongs to workspace
  const { data: task } = await supabase
    .from("task_queue")
    .select("id, status, title")
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .single();

  if (!task) {
    await TelegramAdapter.answerCallback(callbackQueryId, "Task not found");
    return NextResponse.json({ ok: true });
  }

  if (task.status !== "pending-approval") {
    await TelegramAdapter.answerCallback(callbackQueryId, "Task is no longer pending approval");
    await TelegramAdapter.editMessage(chatId, messageId, `📋 *${escapeMarkdown(task.title || "Task")}*\n\n⚠️ Task đã được xử lý trước đó`);
    return NextResponse.json({ ok: true });
  }

  try {
    if (action === "approve") {
      const rating = parseInt(param, 10);
      const now = new Date().toISOString();

      await supabase
        .from("task_queue")
        .update({
          status: "completed",
          approval_status: "approved",
          approval_rating: rating,
          approved_by: profile.id,
          approved_at: now,
          updated_at: now,
        })
        .eq("id", taskId);

      await TelegramAdapter.answerCallback(callbackQueryId, `✅ Approved with ${rating}⭐`);
      await TelegramAdapter.editMessage(
        chatId,
        messageId,
        `📋 *${escapeMarkdown(task.title || "Task")}*\n\n✅ Đã duyệt \\- ${rating}⭐`
      );
    } else if (action === "reject") {
      const rejectAction = param; // revise, reassign, cancel
      const now = new Date().toISOString();

      const updateData: Record<string, unknown> = {
        approval_status: "rejected",
        approved_by: profile.id,
        updated_at: now,
      };

      switch (rejectAction) {
        case "revise":
          updateData.status = "queued";
          updateData.progress_percent = 0;
          updateData.completed_at = null;
          updateData.output = null;
          break;
        case "reassign":
          updateData.status = "queued";
          updateData.assigned_agent_id = null;
          updateData.claimed_at = null;
          updateData.progress_percent = 0;
          updateData.completed_at = null;
          updateData.output = null;
          break;
        case "cancel":
          updateData.status = "cancelled";
          break;
        default:
          await TelegramAdapter.answerCallback(callbackQueryId, "Unknown action");
          return NextResponse.json({ ok: true });
      }

      await supabase.from("task_queue").update(updateData).eq("id", taskId);

      const actionLabels: Record<string, string> = {
        revise: "Yêu cầu sửa lại",
        reassign: "Giao agent khác",
        cancel: "Đã hủy",
      };

      await TelegramAdapter.answerCallback(callbackQueryId, `❌ ${actionLabels[rejectAction]}`);
      await TelegramAdapter.editMessage(
        chatId,
        messageId,
        `📋 *${escapeMarkdown(task.title || "Task")}*\n\n❌ ${escapeMarkdown(actionLabels[rejectAction])}`
      );
    }
  } catch (err) {
    await TelegramAdapter.answerCallback(callbackQueryId, "Error processing action");
    console.error("Telegram webhook error:", err);
  }

  return NextResponse.json({ ok: true });
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}
