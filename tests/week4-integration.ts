/**
 * Week 4 Integration Tests - Retry, Reassign, Task History
 * Run: npx tsx tests/week4-integration.ts
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ceioktxdsxvbagycrveh.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

let API_KEY = "";
let WORKSPACE_ID = "";
let AGENT_1_ID = "";
let AGENT_2_ID = "";
let passed = 0;
let failed = 0;
const results: string[] = [];

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    results.push(`  ✅ ${name}`);
  } else {
    failed++;
    results.push(`  ❌ ${name}`);
  }
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, data: await res.json() };
}

async function setup() {
  // Get workspace + api key
  const { data: ws } = await supabase.from("workspaces").select("id").limit(1).single();
  WORKSPACE_ID = ws!.id;

  // Get raw API key - find the key_prefix then construct or query
  const { data: keyRow } = await supabase
    .from("workspace_api_keys")
    .select("key_hash, key_prefix")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("is_active", true)
    .limit(1)
    .single();

  // We need to create a known API key for testing
  const testKey = "cm_testkey_week4_" + Date.now();
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(testKey));
  const keyHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  await supabase.from("workspace_api_keys").insert({
    workspace_id: WORKSPACE_ID,
    key_hash: keyHash,
    key_prefix: testKey.slice(0, 11),
    name: "Week4 Test",
    is_active: true,
  });

  API_KEY = testKey;

  // Create 2 test agents with skills
  const agent1Name = `test-agent-1-${Date.now()}`;
  const agent2Name = `test-agent-2-${Date.now()}`;

  const { data: a1 } = await supabase
    .from("agents")
    .insert({ workspace_id: WORKSPACE_ID, name: agent1Name, type: "custom", status: "online" })
    .select("id")
    .single();
  AGENT_1_ID = a1!.id;

  const { data: a2 } = await supabase
    .from("agents")
    .insert({ workspace_id: WORKSPACE_ID, name: agent2Name, type: "custom", status: "online" })
    .select("id")
    .single();
  AGENT_2_ID = a2!.id;

  // Add unique skills to avoid collision with existing agents
  const uniqueSkill = `test_skill_${Date.now()}`;
  const uniqueSkill2 = `test_skill2_${Date.now()}`;
  await supabase.from("agent_skills").insert([
    { agent_id: AGENT_1_ID, skill: uniqueSkill },
    { agent_id: AGENT_1_ID, skill: uniqueSkill2 },
    { agent_id: AGENT_2_ID, skill: uniqueSkill },
    { agent_id: AGENT_2_ID, skill: "design" },
  ]);
  // Store for use in tests
  (globalThis as any).__uniqueSkill = uniqueSkill;
}

async function cleanup() {
  // Clean up test data
  await supabase.from("agents").delete().eq("id", AGENT_1_ID);
  await supabase.from("agents").delete().eq("id", AGENT_2_ID);
  await supabase.from("workspace_api_keys").delete().eq("name", "Week4 Test");
}

async function createTask(title: string, skills: string[] = []) {
  const res = await api("POST", "/api/v1/tasks", {
    title,
    required_skills: skills,
    needs_approval: true,
  });
  return res.data.task_id;
}

async function claimTask(taskId: string, agentId: string) {
  // First ensure task is queued
  await supabase.from("task_queue").update({ status: "queued", assigned_agent_id: null }).eq("id", taskId);
  return api("POST", `/api/v1/tasks/${taskId}/claim`, { agent_id: agentId });
}

// ==================== TEST SUITES ====================

async function testRetryLogic() {
  console.log("\n🔄 Retry Logic Tests");

  // Create a task and claim it
  const taskId = await createTask("Retry Test Task");
  await claimTask(taskId, AGENT_1_ID);

  // Fail #1 → should retry (requeue)
  let res = await api("POST", `/api/v1/tasks/${taskId}/fail`, { error: "timeout error" });
  assert(res.data.status === "queued", "Fail #1: status becomes queued");
  assert(res.data.retry_count === 1, "Fail #1: retry_count = 1");
  assert(res.data.action === "retried", "Fail #1: action = retried");

  // Claim and fail #2
  await claimTask(taskId, AGENT_1_ID);
  res = await api("POST", `/api/v1/tasks/${taskId}/fail`, { error: "timeout error again" });
  assert(res.data.status === "queued", "Fail #2: status becomes queued");
  assert(res.data.retry_count === 2, "Fail #2: retry_count = 2");
  assert(res.data.action === "retried", "Fail #2: action = retried");

  // Claim and fail #3 → permanent failure
  await claimTask(taskId, AGENT_1_ID);
  res = await api("POST", `/api/v1/tasks/${taskId}/fail`, { error: "final timeout" });
  assert(res.data.status === "failed_permanent", "Fail #3: status becomes failed_permanent");
  assert(res.data.retry_count === 3, "Fail #3: retry_count = 3");
  assert(res.data.action === "permanently_failed", "Fail #3: action = permanently_failed");

  // Verify DB state
  const { data: task } = await supabase.from("task_queue").select("retry_count, status").eq("id", taskId).single();
  assert(task!.retry_count === 3, "DB: retry_count persisted as 3");
  assert(task!.status === "failed_permanent", "DB: status persisted as failed_permanent");

  // Cleanup
  await supabase.from("task_history").delete().eq("task_id", taskId);
  await supabase.from("task_queue").delete().eq("id", taskId);
}

async function testReassignFlow() {
  console.log("\n🔀 Reassign Flow Tests");

  // Create task with unique skill
  const uniqueSkill = (globalThis as any).__uniqueSkill;
  const taskId = await createTask("Reassign Test Task", [uniqueSkill]);

  // Manually set up: assign to agent1, set pending-approval
  await supabase.from("task_queue").update({
    status: "pending-approval",
    assigned_agent_id: AGENT_1_ID,
    approval_status: "pending",
  }).eq("id", taskId);

  // Reject with reassign → should find agent2 (also has coding skill)
  let res = await api("POST", `/api/v1/approvals/${taskId}/reject`, {
    action: "reassign",
    feedback: "Not good enough, try another agent",
  });
  assert(res.data.action === "reassign", "Reassign: action = reassign");
  assert(res.data.reassigned_to === AGENT_2_ID, "Reassign: found agent2");
  assert(res.data.no_agent_available === false, "Reassign: agent available");

  // Verify DB
  const { data: t1 } = await supabase.from("task_queue").select("assigned_agent_id, reassignment_count, status").eq("id", taskId).single();
  assert(t1!.assigned_agent_id === AGENT_2_ID, "DB: assigned to agent2");
  assert(t1!.reassignment_count === 1, "DB: reassignment_count = 1");

  // Test reassign with no available agent
  // Set agent2 offline, put task back to pending-approval assigned to agent2
  await supabase.from("agents").update({ status: "offline" }).eq("id", AGENT_2_ID);
  await supabase.from("agents").update({ status: "offline" }).eq("id", AGENT_1_ID);
  await supabase.from("task_queue").update({
    status: "pending-approval",
    assigned_agent_id: AGENT_2_ID,
    approval_status: "pending",
  }).eq("id", taskId);

  res = await api("POST", `/api/v1/approvals/${taskId}/reject`, {
    action: "reassign",
    feedback: "Nobody available",
  });
  assert(res.data.no_agent_available === true, "Reassign no match: no_agent_available = true");
  assert(res.data.status === "queued", "Reassign no match: status = queued");
  assert(typeof res.data.message === "string", "Reassign no match: has message for Sếp");

  // Restore agents
  await supabase.from("agents").update({ status: "online" }).eq("id", AGENT_1_ID);
  await supabase.from("agents").update({ status: "online" }).eq("id", AGENT_2_ID);

  // Cleanup
  await supabase.from("task_history").delete().eq("task_id", taskId);
  await supabase.from("task_queue").delete().eq("id", taskId);
}

async function testTaskHistory() {
  console.log("\n📜 Task History Tests");

  const taskId = await createTask("History Test Task");

  // Claim → fail (creates history entries)
  await claimTask(taskId, AGENT_1_ID);
  await api("POST", `/api/v1/tasks/${taskId}/fail`, { error: "test error" });

  // Fetch history
  let res = await api("GET", `/api/v1/tasks/${taskId}/history`);
  assert(res.status === 200, "History API returns 200");
  assert(res.data.history.length >= 2, "History has at least 2 entries (failed + retried)");
  assert(res.data.task_id === taskId, "History response has correct task_id");

  const eventTypes = res.data.history.map((h: { event_type: string }) => h.event_type);
  assert(eventTypes.includes("failed"), "History contains 'failed' event");
  assert(eventTypes.includes("retried"), "History contains 'retried' event");

  // Check details structure
  const failEvent = res.data.history.find((h: { event_type: string }) => h.event_type === "failed");
  assert(failEvent.details?.error === "test error", "History details contain error message");
  assert(failEvent.actor === AGENT_1_ID, "History actor is the agent");

  // Test 404 for non-existent task
  res = await api("GET", `/api/v1/tasks/00000000-0000-0000-0000-000000000000/history`);
  assert(res.status === 404, "History 404 for non-existent task");

  // Cleanup
  await supabase.from("task_history").delete().eq("task_id", taskId);
  await supabase.from("task_queue").delete().eq("id", taskId);
}

async function testReassignHistory() {
  console.log("\n📝 Reassign History Tracking Tests");

  const uniqueSkill = (globalThis as any).__uniqueSkill;
  const taskId = await createTask("Reassign History Task", [uniqueSkill]);

  await supabase.from("task_queue").update({
    status: "pending-approval",
    assigned_agent_id: AGENT_1_ID,
    approval_status: "pending",
  }).eq("id", taskId);

  await api("POST", `/api/v1/approvals/${taskId}/reject`, {
    action: "reassign",
    feedback: "Reassign test",
  });

  const res = await api("GET", `/api/v1/tasks/${taskId}/history`);
  const eventTypes = res.data.history.map((h: { event_type: string }) => h.event_type);
  assert(eventTypes.includes("rejected"), "Reassign history: has 'rejected' event");
  assert(eventTypes.includes("reassigned"), "Reassign history: has 'reassigned' event");

  const reassignEvent = res.data.history.find((h: { event_type: string }) => h.event_type === "reassigned");
  assert(reassignEvent.details?.previous_agent_id === AGENT_1_ID, "Reassign history: previous_agent_id correct");

  // Cleanup
  await supabase.from("task_history").delete().eq("task_id", taskId);
  await supabase.from("task_queue").delete().eq("id", taskId);
}

// ==================== MAIN ====================
async function main() {
  console.log("🧪 Week 4 Integration Tests\n");
  console.log("Setting up...");

  try {
    await setup();

    await testRetryLogic();
    await testReassignFlow();
    await testTaskHistory();
    await testReassignHistory();
  } catch (err) {
    console.error("Fatal error:", err);
    failed++;
  } finally {
    await cleanup();
  }

  console.log("\n" + results.join("\n"));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);

  if (failed > 0) process.exit(1);
}

main();
