#!/bin/bash
# Security & Infrastructure Audit for Polsia
# Tests headers, DNS, SSL, input validation

echo "🔒 POLSIA SECURITY AUDIT"
echo "========================"
echo ""

# 1. HTTP Security Headers
echo "1️⃣  HTTP SECURITY HEADERS"
echo "---"
echo "Main site (https://polsia.com):"
curl -sI https://polsia.com | grep -iE "content-security|x-frame|x-content|strict-transport|referrer-policy|permissions-policy"

echo ""
echo "API endpoint (https://polsia.com/api/companies/13563):"
curl -sI https://polsia.com/api/companies/13563 | grep -iE "content-security|x-frame|x-content|strict-transport|referrer-policy|permissions-policy"

echo ""
echo ""

# 2. SSL/TLS Configuration
echo "2️⃣  SSL/TLS CONFIGURATION"
echo "---"
curl -vI https://polsia.com 2>&1 | grep -iE "ssl|tls|cipher|certificate"

echo ""
echo ""

# 3. DNS Records
echo "3️⃣  DNS RECORDS"
echo "---"
echo "A records:"
dig +short polsia.com A
echo ""
echo "AAAA records (IPv6):"
dig +short polsia.com AAAA
echo ""
echo "MX records (email):"
dig +short polsia.com MX
echo ""
echo "TXT records (SPF, DKIM, etc.):"
dig +short polsia.com TXT
echo ""

# 4. Subdomains
echo ""
echo "4️⃣  COMMON SUBDOMAINS"
echo "---"
for sub in api www app staging dev admin mail; do
  ip=$(dig +short $sub.polsia.com A | head -1)
  if [ ! -z "$ip" ]; then
    echo "✅ $sub.polsia.com → $ip"
  fi
done

echo ""
echo ""

# 5. Server Headers
echo "5️⃣  SERVER IDENTIFICATION HEADERS"
echo "---"
curl -sI https://polsia.com | grep -iE "server|x-powered-by|x-render|via|cf-ray"

echo ""
echo ""

# 6. CORS Configuration
echo "6️⃣  CORS CONFIGURATION"
echo "---"
curl -sI -H "Origin: https://evil.com" https://polsia.com/api/companies/13563 | grep -iE "access-control"

echo ""
echo ""

# 7. Rate Limiting
echo "7️⃣  RATE LIMITING HEADERS"
echo "---"
curl -sI https://polsia.com/api/companies/13563 | grep -iE "rate-limit|x-ratelimit|retry-after"

echo ""
echo ""

echo "✅ Security audit complete!"
echo ""
