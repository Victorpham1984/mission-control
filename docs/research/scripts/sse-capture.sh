#!/bin/bash
# SSE Stream Capture for Polsia

AUTH_JSON="/Users/bizmatehub/.openclaw/workspace/state/polsia-auth.json"
SESSION_COOKIE=$(cat "$AUTH_JSON" | grep -A5 '"name": "polsia_session"' | grep '"value"' | cut -d'"' -f4)

if [ -z "$SESSION_COOKIE" ]; then
  echo "Error: Could not extract polsia_session cookie"
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOGFILE="../data/sse-captures/stream-$TIMESTAMP.log"

echo "🔌 Connecting to SSE stream..."
echo "Endpoint: https://polsia.com/api/executions/stream?companyId=13563"
echo "Log file: $LOGFILE"
echo "---"

# Connect with -L to follow redirects
curl -N -L -v \
  -H "Cookie: polsia_session=$SESSION_COOKIE" \
  -H "Accept: text/event-stream" \
  "https://polsia.com/api/executions/stream?companyId=13563" \
  2>&1 | tee "$LOGFILE"

