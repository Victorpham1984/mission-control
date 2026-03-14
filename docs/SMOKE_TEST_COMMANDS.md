# Smoke Test — Playbook Execution Loop

Replace `$BASE_URL` and `$API_KEY` with your staging/prod values.

```bash
export BASE_URL=https://your-staging.vercel.app
export API_KEY=your-workspace-api-key
```

## 1. List available playbooks (marketplace)

```bash
curl -s "$BASE_URL/api/v1/playbooks?limit=5" \
  -H "Authorization: Bearer $API_KEY" | jq .
```

## 2. Install playbook to company (skip if already installed)

```bash
curl -s -X POST "$BASE_URL/api/v1/playbooks/$PLAYBOOK_ID/install" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"company_id": "$COMPANY_ID"}' | jq .
```

## 3. Run playbook

```bash
curl -s -X POST "$BASE_URL/api/v1/installed-playbooks/$INSTALLED_ID/run" \
  -H "Authorization: Bearer $API_KEY" | jq .
```

Expected: `201` with `run_id`, `tasks_created`, `steps[]`.

## 4. Check spawned tasks

```bash
curl -s "$BASE_URL/api/v1/tasks?status=queued&limit=10" \
  -H "Authorization: Bearer $API_KEY" | jq '.tasks[] | {id, title, type, status}'
```

## 5. Agent claims a task

```bash
curl -s -X POST "$BASE_URL/api/v1/tasks/$TASK_ID/claim" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "$AGENT_ID"}' | jq .
```

## 6. Agent discovers tools for task

```bash
curl -s "$BASE_URL/api/v1/tasks/$TASK_ID/tools?agent_id=$AGENT_ID" \
  -H "Authorization: Bearer $API_KEY" | jq '.tools[] | {name, serverId}'
```

## 7. Agent executes tool

```bash
curl -s -X POST "$BASE_URL/api/v1/tasks/$TASK_ID/execute-tool" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "$AGENT_ID",
    "server_id": "$SERVER_ID",
    "tool_name": "echo",
    "arguments": {"message": "smoke test"}
  }' | jq .
```

## 8. Agent completes task (triggers action log + notification)

```bash
curl -s -X POST "$BASE_URL/api/v1/tasks/$TASK_ID/complete" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "$AGENT_ID",
    "output": {"orders_processed": 12, "status": "smoke test complete"}
  }' | jq .
```

Expected: `notification_sent: true` (if Telegram configured).

## 9. Verify action logged (DB query)

```sql
SELECT id, action_type, success, duration_ms, created_at
FROM actions
WHERE installed_playbook_id = '$INSTALLED_ID'
ORDER BY created_at DESC
LIMIT 5;
```

## 10. Verify notification sent (DB query)

```sql
SELECT channel, status, message, sent_at
FROM notification_log
WHERE task_id = '$TASK_ID'
ORDER BY created_at DESC
LIMIT 1;
```

## 11. Idempotency check — second run should fail with 409

```bash
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE_URL/api/v1/installed-playbooks/$INSTALLED_ID/run" \
  -H "Authorization: Bearer $API_KEY"
```

Expected: `409 Conflict` with `"run_in_progress"`.
