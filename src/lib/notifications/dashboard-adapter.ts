import { SupabaseClient } from "@supabase/supabase-js";
import { NotificationPayload, NotificationResult } from "./types";

export class DashboardAdapter {
  static async send(
    supabase: SupabaseClient,
    userId: string,
    payload: NotificationPayload
  ): Promise<NotificationResult> {
    try {
      const { data, error } = await supabase
        .from("notification_log")
        .insert({
          user_id: userId,
          task_id: payload.taskId,
          channel: "dashboard",
          status: "sent",
          message: formatMessage(payload),
          sent_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, externalId: data.id };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}

function formatMessage(payload: NotificationPayload): string {
  switch (payload.event) {
    case "pending_approval":
      return `Task "${payload.taskTitle}" hoàn thành — cần duyệt`;
    case "completed":
      return `Task "${payload.taskTitle}" đã hoàn thành`;
    case "failed_permanent":
      return `Task "${payload.taskTitle}" thất bại vĩnh viễn`;
  }
}
