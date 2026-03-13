#!/usr/bin/env node

/**
 * Polsia API Backend Probe
 * Day 2 Research: Backend Architecture Detection
 * 
 * Goals:
 * - Detect server stack from headers
 * - Identify auth mechanism
 * - Infer database type
 * - Capture API samples
 * - Test error handling
 */

const fs = require('fs');
const https = require('https');

// Load saved cookies
const authData = JSON.parse(fs.readFileSync('/Users/bizmatehub/.openclaw/workspace/state/polsia-auth.json', 'utf8'));

// Extract polsia_session cookie
const polsiaCookie = authData.cookies.find(c => c.name === 'polsia_session');
if (!polsiaCookie) {
  console.error('ERROR: polsia_session cookie not found!');
  process.exit(1);
}

const cookieHeader = `polsia_session=${polsiaCookie.value}`;

// Helper: Make authenticated request
function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'polsia.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://polsia.com/',
        'Origin': 'https://polsia.com'
      }
    };

    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }

    const req = https.request(options, (res) => {
      let data = '';
      
      // Capture response headers
      const responseData = {
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        headers: res.headers,
        body: null
      };

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          responseData.body = JSON.parse(data);
        } catch (e) {
          responseData.body = data;
        }
        resolve(responseData);
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Test suite
async function runProbe() {
  console.log('🔍 Polsia Backend Architecture Probe - Day 2\n');
  console.log('═══════════════════════════════════════════\n');

  const results = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  // Test 1: Auth check endpoint
  console.log('Test 1: Auth Check Endpoint');
  console.log('─────────────────────────────');
  try {
    const authCheck = await makeRequest('/api/auth/check');
    console.log('Status:', authCheck.statusCode);
    console.log('Headers:', JSON.stringify(authCheck.headers, null, 2));
    console.log('Body:', JSON.stringify(authCheck.body, null, 2));
    console.log('');
    
    results.tests.push({
      name: 'auth_check',
      endpoint: '/api/auth/check',
      method: 'GET',
      response: authCheck
    });

    // Analyze server signature
    const serverHeader = authCheck.headers['server'];
    const poweredBy = authCheck.headers['x-powered-by'];
    const runtime = authCheck.headers['x-runtime'];
    
    if (serverHeader) console.log('🎯 Server Signature:', serverHeader);
    if (poweredBy) console.log('🎯 Powered By:', poweredBy);
    if (runtime) console.log('🎯 Runtime Header:', runtime);
    
  } catch (e) {
    console.error('ERROR:', e.message);
  }

  console.log('\n');

  // Test 2: User/Company data endpoint
  console.log('Test 2: User Profile Endpoint (if exists)');
  console.log('─────────────────────────────────────────');
  try {
    const userProfile = await makeRequest('/api/user');
    console.log('Status:', userProfile.statusCode);
    console.log('Headers:', JSON.stringify(userProfile.headers, null, 2));
    console.log('Body:', JSON.stringify(userProfile.body, null, 2));
    console.log('');
    
    results.tests.push({
      name: 'user_profile',
      endpoint: '/api/user',
      method: 'GET',
      response: userProfile
    });
  } catch (e) {
    console.error('ERROR:', e.message);
  }

  console.log('\n');

  // Test 3: Company list endpoint
  console.log('Test 3: Companies List');
  console.log('─────────────────────');
  try {
    const companies = await makeRequest('/api/companies');
    console.log('Status:', companies.statusCode);
    console.log('Headers:', JSON.stringify(companies.headers, null, 2));
    console.log('Body:', JSON.stringify(companies.body, null, 2));
    console.log('');
    
    results.tests.push({
      name: 'companies_list',
      endpoint: '/api/companies',
      method: 'GET',
      response: companies
    });

    // If we have a company, test nested endpoints
    if (companies.body && Array.isArray(companies.body) && companies.body.length > 0) {
      const companyId = companies.body[0].id || 13563;
      
      // Test 4: Company documents
      console.log('\nTest 4: Company Documents');
      console.log('─────────────────────────');
      const docs = await makeRequest(`/api/companies/${companyId}/documents`);
      console.log('Status:', docs.statusCode);
      console.log('Body sample:', JSON.stringify(docs.body, null, 2).substring(0, 500));
      
      results.tests.push({
        name: 'company_documents',
        endpoint: `/api/companies/${companyId}/documents`,
        method: 'GET',
        response: docs
      });

      // Test 5: Company links
      console.log('\nTest 5: Company Links');
      console.log('─────────────────────');
      const links = await makeRequest(`/api/companies/${companyId}/links`);
      console.log('Status:', links.statusCode);
      console.log('Body:', JSON.stringify(links.body, null, 2));
      
      results.tests.push({
        name: 'company_links',
        endpoint: `/api/companies/${companyId}/links`,
        method: 'GET',
        response: links
      });
    }
  } catch (e) {
    console.error('ERROR:', e.message);
  }

  console.log('\n');

  // Test 6: Invalid endpoint (error handling)
  console.log('Test 6: Error Handling (404 Test)');
  console.log('──────────────────────────────────');
  try {
    const notFound = await makeRequest('/api/nonexistent');
    console.log('Status:', notFound.statusCode);
    console.log('Body:', JSON.stringify(notFound.body, null, 2));
    
    results.tests.push({
      name: 'error_404',
      endpoint: '/api/nonexistent',
      method: 'GET',
      response: notFound
    });
  } catch (e) {
    console.error('ERROR:', e.message);
  }

  console.log('\n');

  // Test 7: Rate limiting test
  console.log('Test 7: Rate Limiting Detection');
  console.log('────────────────────────────────');
  const rateLimitTests = [];
  for (let i = 0; i < 10; i++) {
    try {
      const start = Date.now();
      const resp = await makeRequest('/api/auth/check');
      const duration = Date.now() - start;
      console.log(`Request ${i + 1}: ${resp.statusCode} (${duration}ms)`);
      rateLimitTests.push({
        requestNum: i + 1,
        statusCode: resp.statusCode,
        duration: duration,
        rateLimitHeader: resp.headers['x-ratelimit-remaining'] || resp.headers['ratelimit-remaining']
      });
    } catch (e) {
      console.error(`Request ${i + 1}: ERROR -`, e.message);
    }
  }
  
  results.tests.push({
    name: 'rate_limiting',
    requests: rateLimitTests
  });

  console.log('\n');

  // Save results
  const outputPath = '/Users/bizmatehub/.openclaw/workspace-phat/research/data/day-2-backend-probe.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log('✅ Results saved to:', outputPath);

  console.log('\n═══════════════════════════════════════════');
  console.log('📊 Backend Analysis Summary');
  console.log('═══════════════════════════════════════════\n');

  // Infer backend stack from collected data
  const firstTest = results.tests[0]?.response;
  if (firstTest) {
    const headers = firstTest.headers;
    
    console.log('🔍 Server Detection:');
    if (headers.server) console.log('   Server:', headers.server);
    if (headers['x-powered-by']) console.log('   Powered-by:', headers['x-powered-by']);
    if (headers['x-runtime']) console.log('   Runtime:', headers['x-runtime'], '(likely Rails)');
    
    console.log('\n🔐 Authentication:');
    const setCookie = headers['set-cookie'];
    if (setCookie) {
      console.log('   Session Management: Cookie-based');
      console.log('   Cookie Details:', setCookie);
    } else {
      console.log('   Session Management: Stateless (JWT likely)');
    }
    
    console.log('\n📦 Response Format:');
    const contentType = headers['content-type'];
    console.log('   Content-Type:', contentType);
    
    console.log('\n💾 Database Inference:');
    const bodyKeys = firstTest.body ? Object.keys(firstTest.body) : [];
    const hasSnakeCase = bodyKeys.some(k => k.includes('_'));
    const hasCamelCase = bodyKeys.some(k => /[a-z][A-Z]/.test(k));
    
    if (hasSnakeCase) {
      console.log('   Naming Convention: snake_case → likely PostgreSQL/MySQL with Rails/Django');
    } else if (hasCamelCase) {
      console.log('   Naming Convention: camelCase → likely MongoDB or Node.js backend');
    }
  }

  console.log('\n✅ Probe Complete!\n');
}

runProbe().catch(console.error);
