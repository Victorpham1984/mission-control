import { NextRequest } from "next/server";
import { authenticateUserOrApiKey, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { logTaskEvent } from "@/lib/api/task-history";

// POST /api/v1/approvals/:taskId/reject
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { taskId } = await params;
  let body;
  try { body = await req.json(); } catch { return apiError("validation_error", "Invalid JSON body"); }

  const supabase = getServiceClient();

  // Verify task is pending approval
  const { data: task } = await supabase
    .from("task_queue")
    .select("id, status, assigned_agent_id, required_skills, reassignment_count")
    .eq("id", taskId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (!task) return apiError("task_not_found", "Task not found", 404);
  if (task.status !== "pending-approval") {
    return apiError("validation_error", "Task is not pending approval");
  }

  const action = body.action || "revise";
  const now = new Date().toISOString();
  const actor = auth.userId || "system";

  const updateData: Record<string, unknown> = {
    approval_status: "rejected",
    approval_feedback: body.feedback || null,
    approved_by: auth.userId || null,
    updated_at: now,
  };

  let reassignedTo: string | null = null;
  let noAgentAvailable = false;

  switch (action) {
    case "revise":
      updateData.status = "queued";
      updateData.progress_percent = 0;
      updateData.completed_at = null;
      updateData.output = null;

      await logTaskEvent(supabase, taskId, "rejected", actor, {
        action: "revise",
        feedback: body.feedback,
        agent_id: task.assigned_agent_id,
      });
      break;

    case "reassign": {
      updateData.status = "queued";
      updateData.assigned_agent_id = null;
      updateData.claimed_at = null;
      updateData.progress_percent = 0;
      updateData.completed_at = null;
      updateData.output = null;
      updateData.reassignment_count = ((task.reassignment_count as number) || 0) + 1;

      const previousAgentId = task.assigned_agent_id;
      const reqSkills = (task.required_skills as string[]) || [];

      await logTaskEvent(supabase, taskId, "rejected", actor, {
        action: "reassign",
        feedback: body.feedback,
        previous_agent_id: previousAgentId,
      });

      // Try to find another matching agent
      if (reqSkills.length > 0) {
        const { data: matchingSkills } = await supabase
          .from("agent_skills")
          .select("agent_id, skill")
          .in("skill", reqSkills);

        if (matchingSkills && matchingSkills.length > 0) {
          // Exclude the previous agent
          const candidateIds = [...new Set(matchingSkills.map((s) => s.agent_id))]
            .filter((id) => id !== previousAgentId);

          if (candidateIds.length > 0) {
            const { data: idleAgents } = await supabase
              .from("agents")
              .select("id")
              .eq("workspace_id", auth.workspaceId)
              .eq("status", "online")
              .in("id", candidateIds)
              .limit(1);

            if (idleAgents && idleAgents.length > 0) {
              const newAgentId = idleAgents[0].id;
              // Check agent doesn't have too many in-progress tasks
              const { count: activeCount } = await supabase
                .from("task_queue")
                .select("*", { count: "exact", head: true })
                .eq("assigned_agent_id", newAgentId)
                .eq("status", "in-progress");

              if ((activeCount ?? 0) === 0) {
                updateData.assigned_agent_id = newAgentId;
                updateData.status = "in-progress";
                updateData.claimed_at = now;
                reassignedTo = newAgentId;
              }
            }
          }
        }
      }

      if (!reassignedTo) {
        noAgentAvailable = true;
      }

      await logTaskEvent(supabase, taskId, "reassigned", "system", {
        previous_agent_id: previousAgentId,
        new_agent_id: reassignedTo,
        no_agent_available: noAgentAvailable,
      });
      break;
    }

    case "cancel":
      updateData.status = "cancelled";
      await logTaskEvent(supabase, taskId, "rejected", actor, {
        action: "cancel",
        feedback: body.feedback,
      });
      break;

    default:
      return apiError("validation_error", "action must be 'revise', 'reassign', or 'cancel'");
  }

  await supabase
    .from("task_queue")
    .update(updateData)
    .eq("id", taskId);

  const response: Record<string, unknown> = {
    task_id: taskId,
    status: updateData.status as string,
    action,
  };

  if (action === "reassign") {
    response.reassigned_to = reassignedTo;
    response.no_agent_available = noAgentAvailable;
    if (noAgentAvailable) {
      response.message = "No matching agent available. Task is queued for manual assignment.";
    }
  }

  return apiSuccess(response);
}
