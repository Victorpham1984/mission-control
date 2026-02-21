export type NotificationEvent = "completed" | "pending_approval" | "failed_permanent";

export type NotificationChannel = "dashboard" | "telegram" | "zalo" | "email";

export interface NotificationPayload {
  taskId: string;
  taskTitle: string;
  event: NotificationEvent;
  agentName?: string;
  outputPreview?: string;
  error?: string;
}

export interface NotificationResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

export interface UserPreferences {
  userId: string;
  telegramChatId?: string;
  preferredChannel: NotificationChannel;
  notificationSettings: {
    task_completed: boolean;
    task_approval_needed: boolean;
    task_failed: boolean;
  };
}
