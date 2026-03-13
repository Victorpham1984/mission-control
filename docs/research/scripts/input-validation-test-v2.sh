#!/bin/bash
# Input Validation & Error Handling Test
# Using curl for more flexible testing

AUTH_JSON="/Users/bizmatehub/.openclaw/workspace/state/polsia-auth.json"
SESSION_COOKIE=$(cat "$AUTH_JSON" | grep -A5 '"name": "polsia_session"' | grep '"value"' | cut -d'"' -f4)

echo "🛡️  INPUT VALIDATION TEST"
echo "="
echo ""

# Test 1: Invalid ID (string)
echo "1️⃣  Invalid ID format (string 'abc'):"
curl -s -H "Cookie: polsia_session=$SESSION_COOKIE" \
  https://polsia.com/api/companies/abc | head -c 100
echo ""
echo ""

# Test 2: Negative ID
echo "2️⃣  Negative ID (-1):"
curl -s -H "Cookie: polsia_session=$SESSION_COOKIE" \
  https://polsia.com/api/companies/-1 | head -c 100
echo ""
echo ""

# Test 3: Very long ID
echo "3️⃣  Overly long ID (100 chars):"
curl -s -H "Cookie: polsia_session=$SESSION_COOKIE" \
  "https://polsia.com/api/companies/$(printf '9%.0s' {1..100})" | head -c 100
echo ""
echo ""

# Test 4: Non-existent company
echo "4️⃣  Non-existent company (99999):"
curl -s -H "Cookie: polsia_session=$SESSION_COOKIE" \
  https://polsia.com/api/companies/99999 | head -c 100
echo ""
echo ""

# Test 5: Different company (IDOR test)
echo "5️⃣  IDOR test (company ID 1):"
curl -s -H "Cookie: polsia_session=$SESSION_COOKIE" \
  https://polsia.com/api/companies/1 | head -c 100
echo ""
echo ""

# Test 6: XSS in query parameter
echo "6️⃣  XSS in query param:"
curl -s -H "Cookie: polsia_session=$SESSION_COOKIE" \
  "https://polsia.com/api/companies/13563?test=%3Cscript%3Ealert(1)%3C/script%3E" | head -c 100
echo ""
echo ""

# Test 7: Path traversal
echo "7️⃣  Path traversal (../):"
curl -s -H "Cookie: polsia_session=$SESSION_COOKIE" \
  https://polsia.com/api/companies/../users | head -c 100
echo ""
echo ""

# Test 8: Nonexistent endpoint (error verbosity test)
echo "8️⃣  Nonexistent endpoint (error messages):"
curl -s -H "Cookie: polsia_session=$SESSION_COOKIE" \
  https://polsia.com/api/totally/fake/endpoint | head -c 200
echo ""
echo ""

# Test 9: No auth header (should 401)
echo "9️⃣  No authentication (should 401):"
curl -s https://polsia.com/api/companies/13563 | head -c 100
echo ""
echo ""

echo "✅ Tests complete!"
