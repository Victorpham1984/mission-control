import { NotificationPayload, NotificationResult } from "./types";

const TELEGRAM_API = "https://api.telegram.org/bot";

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");
  return token;
}

function buildMessage(payload: NotificationPayload): string {
  switch (payload.event) {
    case "pending_approval":
      return [
        `✅ Task hoàn thành — cần duyệt`,
        ``,
        `📋 *${escapeMarkdown(payload.taskTitle)}*`,
        payload.agentName ? `🤖 Agent: ${escapeMarkdown(payload.agentName)}` : "",
        payload.outputPreview
          ? `📝 Output: ${escapeMarkdown(payload.outputPreview.slice(0, 200))}${payload.outputPreview.length > 200 ? "..." : ""}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

    case "completed":
      return [
        `✅ Task đã hoàn thành`,
        ``,
        `📋 *${escapeMarkdown(payload.taskTitle)}*`,
        payload.agentName ? `🤖 Agent: ${escapeMarkdown(payload.agentName)}` : "",
      ]
        .filter(Boolean)
        .join("\n");

    case "failed_permanent":
      return [
        `❌ Task thất bại vĩnh viễn`,
        ``,
        `📋 *${escapeMarkdown(payload.taskTitle)}*`,
        payload.error ? `💥 Error: ${escapeMarkdown(payload.error.slice(0, 300))}` : "",
      ]
        .filter(Boolean)
        .join("\n");
  }
}

function buildInlineKeyboard(taskId: string, event: string) {
  if (event === "pending_approval") {
    return {
      inline_keyboard: [
        [
          { text: "⭐⭐⭐⭐⭐ Approve", callback_data: `approve:${taskId}:5` },
        ],
        [
          { text: "⭐⭐⭐⭐ Approve", callback_data: `approve:${taskId}:4` },
          { text: "⭐⭐⭐ Approve", callback_data: `approve:${taskId}:3` },
        ],
        [
          { text: "❌ Reject → Revise", callback_data: `reject:${taskId}:revise` },
          { text: "❌ Reject → Reassign", callback_data: `reject:${taskId}:reassign` },
        ],
        [
          { text: "🚫 Cancel Task", callback_data: `reject:${taskId}:cancel` },
        ],
      ],
    };
  }
  return undefined;
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

export class TelegramAdapter {
  static async send(
    chatId: string,
    payload: NotificationPayload
  ): Promise<NotificationResult> {
    const token = getBotToken();
    const message = buildMessage(payload);
    const replyMarkup = buildInlineKeyboard(payload.taskId, payload.event);

    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: message,
      parse_mode: "MarkdownV2",
    };
    if (replyMarkup) body.reply_markup = replyMarkup;

    try {
      const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.ok) {
        return { success: false, error: data.description || "Telegram API error" };
      }
      return { success: true, externalId: String(data.result.message_id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  static async editMessage(
    chatId: string,
    messageId: number,
    text: string
  ): Promise<void> {
    const token = getBotToken();
    await fetch(`${TELEGRAM_API}${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "MarkdownV2",
      }),
    });
  }

  static async answerCallback(callbackQueryId: string, text: string): Promise<void> {
    const token = getBotToken();
    await fetch(`${TELEGRAM_API}${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  }
}
