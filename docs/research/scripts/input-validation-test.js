#!/usr/bin/env node
/**
 * Input Validation & Error Handling Test
 * Ethical testing only - no exploitation attempts
 */

const https = require('https');
const fs = require('fs');

const authPath = '/Users/bizmatehub/.openclaw/workspace/state/polsia-auth.json';
const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
const sessionCookie = auth.cookies.find(c => c.name === 'polsia_session')?.value;

console.log('🛡️  INPUT VALIDATION & ERROR HANDLING TEST');
console.log('='.repeat(80));
console.log('ℹ️  Ethical testing only - no exploitation');
console.log('');

function apiRequest(method, path, body = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'polsia.com',
      path,
      method,
      headers: {
        'Cookie': `polsia_session=${sessionCookie}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ 
            status: res.statusCode, 
            data: JSON.parse(data),
            headers: res.headers,
            raw: data
          });
        } catch (e) {
          resolve({ 
            status: res.statusCode, 
            data: null,
            headers: res.headers,
            raw: data 
          });
        }
      });
    });

    req.on('error', (e) => resolve({ 
      status: 'ERROR', 
      error: e.message 
    }));
    
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ status: 'TIMEOUT' });
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function main() {
  const results = [];
  
  // Test 1: Invalid ID (string instead of number)
  console.log('1️⃣  Invalid ID format (string)');
  const test1 = await apiRequest('GET', '/api/companies/abc');
  console.log(`   Status: ${test1.status}`);
  console.log(`   Response: ${test1.raw?.slice(0, 100) || 'None'}`);
  results.push({ test: 'Invalid ID (string)', status: test1.status, leaksInfo: test1.raw?.includes('stack') || test1.raw?.includes('Error:') });
  console.log('');
  
  // Test 2: SQL injection attempt (safe - just test detection)
  console.log('2️⃣  SQL injection pattern (safe test)');
  const test2 = await apiRequest('GET', `/api/companies/1' OR '1'='1`);
  console.log(`   Status: ${test2.status}`);
  console.log(`   Response: ${test2.raw?.slice(0, 100) || 'None'}`);
  results.push({ test: 'SQL injection pattern', status: test2.status, blocked: test2.status === 400 || test2.status === 403 });
  console.log('');
  
  // Test 3: XSS in URL parameter
  console.log('3️⃣  XSS pattern in URL');
  const test3 = await apiRequest('GET', `/api/companies/13563?name=<script>alert(1)</script>`);
  console.log(`   Status: ${test3.status}`);
  console.log(`   Response: ${test3.raw?.slice(0, 100) || 'None'}`);
  results.push({ test: 'XSS in URL param', status: test3.status, reflected: test3.raw?.includes('<script>') });
  console.log('');
  
  // Test 4: Very long ID (DoS test)
  console.log('4️⃣  Overly long ID');
  const longId = '9'.repeat(100);
  const test4 = await apiRequest('GET', `/api/companies/${longId}`);
  console.log(`   Status: ${test4.status}`);
  console.log(`   Response: ${test4.raw?.slice(0, 100) || 'None'}`);
  results.push({ test: 'Long ID (100 chars)', status: test4.status, handled: test4.status === 400 || test4.status === 404 });
  console.log('');
  
  // Test 5: Negative ID
  console.log('5️⃣  Negative ID');
  const test5 = await apiRequest('GET', '/api/companies/-1');
  console.log(`   Status: ${test5.status}`);
  console.log(`   Response: ${test5.raw?.slice(0, 100) || 'None'}`);
  results.push({ test: 'Negative ID', status: test5.status });
  console.log('');
  
  // Test 6: Non-existent company (access control)
  console.log('6️⃣  Access to non-existent company');
  const test6 = await apiRequest('GET', '/api/companies/99999');
  console.log(`   Status: ${test6.status}`);
  console.log(`   Response: ${test6.raw?.slice(0, 100) || 'None'}`);
  results.push({ test: 'Non-existent company', status: test6.status, proper404: test6.status === 404 });
  console.log('');
  
  // Test 7: Different company (IDOR test - accessing another user's company)
  console.log('7️⃣  Access to different company ID (IDOR test)');
  const test7 = await apiRequest('GET', '/api/companies/1');
  console.log(`   Status: ${test7.status}`);
  console.log(`   Response: ${test7.raw?.slice(0, 100) || 'None'}`);
  results.push({ test: 'IDOR (company 1)', status: test7.status, blocked: test7.status === 403 || test7.status === 404 });
  console.log('');
  
  // Test 8: Path traversal
  console.log('8️⃣  Path traversal attempt');
  const test8 = await apiRequest('GET', '/api/companies/../users');
  console.log(`   Status: ${test8.status}`);
  console.log(`   Response: ${test8.raw?.slice(0, 100) || 'None'}`);
  results.push({ test: 'Path traversal', status: test8.status });
  console.log('');
  
  // Test 9: Error message verbosity
  console.log('9️⃣  Error message analysis');
  const errorTest = await apiRequest('GET', '/api/nonexistent/endpoint/test');
  console.log(`   Status: ${errorTest.status}`);
  console.log(`   Response: ${errorTest.raw?.slice(0, 200) || 'None'}`);
  const leaksStack = errorTest.raw?.includes('at ') || errorTest.raw?.includes('node_modules');
  const leaksPath = errorTest.raw?.includes('/app/') || errorTest.raw?.includes('/src/');
  results.push({ 
    test: 'Error verbosity', 
    status: errorTest.status, 
    leaksStack, 
    leaksPath 
  });
  console.log('');
  
  // Summary
  console.log('='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('-'.repeat(80));
  
  const findings = [];
  
  results.forEach(r => {
    if (r.leaksInfo) findings.push(`⚠️  ${r.test}: Info leakage in error messages`);
    if (r.reflected) findings.push(`🚨 ${r.test}: XSS reflected in response`);
    if (r.leaksStack) findings.push(`⚠️  ${r.test}: Stack trace exposed`);
    if (r.leaksPath) findings.push(`⚠️  ${r.test}: File paths exposed`);
    if (!r.blocked && r.test.includes('IDOR')) findings.push(`🚨 ${r.test}: No authorization check!`);
    if (!r.blocked && r.test.includes('SQL')) findings.push(`⚠️  ${r.test}: No input sanitization detected`);
  });
  
  if (findings.length === 0) {
    console.log('✅ No major security issues found in basic tests');
  } else {
    console.log(`Found ${findings.length} potential issues:`);
    findings.forEach(f => console.log(`   ${f}`));
  }
  
  console.log('');
  console.log('ℹ️  Note: This is basic testing. Professional penetration testing recommended.');
  console.log('');
  
  // Save results
  fs.writeFileSync(
    '../data/input-validation-results.json',
    JSON.stringify({ timestamp: new Date().toISOString(), results, findings }, null, 2)
  );
  console.log('✅ Results saved to data/input-validation-results.json');
}

main().catch(console.error);
