import { SupabaseClient } from "@supabase/supabase-js";

export async function logTaskEvent(
  supabase: SupabaseClient,
  taskId: string,
  eventType: string,
  actor: string = "system",
  details: Record<string, unknown> = {}
) {
  await supabase.from("task_history").insert({
    task_id: taskId,
    event_type: eventType,
    actor,
    details,
  });
}
