import { SupabaseClient } from "@supabase/supabase-js";
import { TelegramAdapter } from "./telegram-adapter";
import { DashboardAdapter } from "./dashboard-adapter";
import { NotificationEvent, NotificationPayload, NotificationResult, UserPreferences } from "./types";

export { type NotificationEvent, type NotificationPayload } from "./types";

export class NotificationService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Send notification for a task event to the workspace owner.
   */
  async notifyTaskEvent(
    taskId: string,
    event: NotificationEvent,
    workspaceId: string
  ): Promise<NotificationResult> {
    // Get task details
    const { data: task } = await this.supabase
      .from("task_queue")
      .select("id, title, output, error, assigned_agent_id")
      .eq("id", taskId)
      .single();

    if (!task) return { success: false, error: "Task not found" };

    // Get workspace owner
    const { data: workspace } = await this.supabase
      .from("workspaces")
      .select("owner_id")
      .eq("id", workspaceId)
      .single();

    if (!workspace) return { success: false, error: "Workspace not found" };

    // Get user preferences
    const prefs = await this.getUserPreferences(workspace.owner_id);
    if (!prefs) return { success: false, error: "User not found" };

    // Check if user wants this notification type
    const settingKey = event === "pending_approval" ? "task_approval_needed" : event === "completed" ? "task_completed" : "task_failed";
    if (!prefs.notificationSettings[settingKey]) {
      return { success: true }; // User opted out
    }

    // Get agent name
    let agentName: string | undefined;
    if (task.assigned_agent_id) {
      const { data: agent } = await this.supabase
        .from("agents")
        .select("name")
        .eq("id", task.assigned_agent_id)
        .single();
      agentName = agent?.name;
    }

    const payload: NotificationPayload = {
      taskId: task.id,
      taskTitle: task.title || "Untitled Task",
      event,
      agentName,
      outputPreview: task.output ? JSON.stringify(task.output).slice(0, 200) : undefined,
      error: task.error,
    };

    return this.dispatch(prefs, payload);
  }

  private async dispatch(
    prefs: UserPreferences,
    payload: NotificationPayload
  ): Promise<NotificationResult> {
    let result: NotificationResult;

    switch (prefs.preferredChannel) {
      case "telegram":
        if (prefs.telegramChatId) {
          result = await TelegramAdapter.send(prefs.telegramChatId, payload);
          if (result.success) {
            await this.logNotification(prefs.userId, payload, "telegram", result);
            return result;
          }
        }
        // Fallback to dashboard
        result = await DashboardAdapter.send(this.supabase, prefs.userId, payload);
        return result;

      default:
        result = await DashboardAdapter.send(this.supabase, prefs.userId, payload);
        return result;
    }
  }

  private async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    const { data } = await this.supabase
      .from("profiles")
      .select("id, telegram_chat_id, preferred_channel, notification_settings")
      .eq("id", userId)
      .single();

    if (!data) return null;

    return {
      userId: data.id,
      telegramChatId: data.telegram_chat_id,
      preferredChannel: data.preferred_channel || "dashboard",
      notificationSettings: data.notification_settings || {
        task_completed: true,
        task_approval_needed: true,
        task_failed: true,
      },
    };
  }

  private async logNotification(
    userId: string,
    payload: NotificationPayload,
    channel: string,
    result: NotificationResult
  ): Promise<void> {
    await this.supabase.from("notification_log").insert({
      user_id: userId,
      task_id: payload.taskId,
      channel,
      status: result.success ? "sent" : "failed",
      message: `${payload.event}: ${payload.taskTitle}`,
      error: result.error || null,
      external_id: result.externalId || null,
      sent_at: result.success ? new Date().toISOString() : null,
    });
  }
}
