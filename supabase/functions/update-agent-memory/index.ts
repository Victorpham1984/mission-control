import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: agents } = await supabase
    .from("agent_profiles")
    .select("id, workspace_id, agent_id, memory_context");

  if (!agents || agents.length === 0) {
    return new Response(JSON.stringify({ success: true, updated: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let updated = 0;

  for (const agent of agents) {
    // Find matching agents table entries
    const { data: agentRows } = await supabase
      .from("agents")
      .select("id")
      .eq("workspace_id", agent.workspace_id)
      .ilike("external_id", `%${agent.agent_id}%`);

    const agentUuids = (agentRows || []).map((a: { id: string }) => a.id);
    if (agentUuids.length === 0) continue;

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // Fetch recent high-rated tasks
    const { data: positiveTasks } = await supabase
      .from("task_queue")
      .select("description, output, approval_rating, feedback_text")
      .in("assigned_agent_id", agentUuids)
      .gte("approval_rating", 4)
      .gte("completed_at", weekAgo)
      .order("approval_rating", { ascending: false })
      .limit(5);

    // Fetch rejected tasks
    const { data: negativeTasks } = await supabase
      .from("task_queue")
      .select("description, feedback_text")
      .in("assigned_agent_id", agentUuids)
      .eq("approval_status", "rejected")
      .gte("created_at", weekAgo)
      .limit(3);

    const learnings: string[] = [];

    if (positiveTasks && positiveTasks.length > 0) {
      const types = [...new Set(positiveTasks.map((t) => t.description?.split(" ")[0]).filter(Boolean))];
      learnings.push(`✅ High-rated tasks: "${types.slice(0, 3).join(", ")}" work well`);

      // Extract specific feedback
      const feedback = positiveTasks
        .map((t) => t.feedback_text)
        .filter(Boolean)
        .slice(0, 2);
      feedback.forEach((f) => learnings.push(`✅ Feedback: ${f}`));
    }

    if (negativeTasks && negativeTasks.length > 0) {
      const issues = negativeTasks.map((t) => t.feedback_text).filter(Boolean);
      issues.slice(0, 2).forEach((f) => learnings.push(`❌ Avoid: ${f}`));
    }

    if (learnings.length === 0) continue;

    // Merge with existing, keep last 10
    const currentMemory = agent.memory_context || [];
    const updatedMemory = [...learnings, ...currentMemory].slice(0, 10);

    await supabase
      .from("agent_profiles")
      .update({ memory_context: updatedMemory })
      .eq("id", agent.id);

    updated++;
    console.log(`Updated memory for ${agent.agent_id}: +${learnings.length} learnings`);
  }

  return new Response(
    JSON.stringify({ success: true, updated, total_agents: agents.length }),
    { headers: { "Content-Type": "application/json" } }
  );
});
