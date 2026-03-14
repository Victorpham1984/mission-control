import { NextRequest } from "next/server";
import { authenticateUserOrApiKey, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { PlaybookExecutor, PlaybookExecutorError, playbookErrorStatus } from "@/lib/playbooks";

// POST /api/v1/installed-playbooks/:installedId/run — Trigger playbook execution
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ installedId: string }> },
) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { installedId } = await params;
  const supabase = getServiceClient();
  const executor = new PlaybookExecutor(supabase);

  try {
    const result = await executor.run(installedId, auth.workspaceId);

    return apiSuccess({
      run_id: result.runId,
      installed_playbook_id: result.installedPlaybookId,
      playbook_name: result.playbookName,
      tasks_created: result.tasksCreated,
      steps: result.steps,
    }, 201);
  } catch (err) {
    if (err instanceof PlaybookExecutorError) {
      return apiError(err.code, err.message, playbookErrorStatus(err.code));
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return apiError("internal_error", message, 500);
  }
}
