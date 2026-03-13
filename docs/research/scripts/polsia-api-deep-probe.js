#!/usr/bin/env node

/**
 * Polsia API Deep Probe - Day 3
 * Comprehensive endpoint inventory + CRUD testing
 * 
 * Goals:
 * - Map 30+ API endpoints
 * - Test CRUD operations
 * - Capture request/response schemas
 * - Test error handling (400, 401, 403, 404, 422, 500)
 */

const fs = require('fs');
const https = require('https');

// Load auth
const authData = JSON.parse(fs.readFileSync('/Users/bizmatehub/.openclaw/workspace/state/polsia-auth.json', 'utf8'));
const polsiaCookie = authData.cookies.find(c => c.name === 'polsia_session');
const cookieHeader = `polsia_session=${polsiaCookie.value}`;

// Helper: Make request
function req(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'polsia.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Accept': 'application/json',
        'Referer': 'https://polsia.com/',
        'Origin': 'https://polsia.com'
      }
    };

    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }

    const request = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    request.on('error', reject);
    if (body) request.write(JSON.stringify(body));
    request.end();
  });
}

// Main probe
async function probe() {
  console.log('🔍 Polsia API Deep Probe - Day 3\n');
  console.log('═══════════════════════════════════════\n');

  const results = {
    timestamp: new Date().toISOString(),
    endpoints: [],
    schemas: {}
  };

  // First, get company ID
  console.log('🏢 Fetching company data...');
  const companies = await req('/api/companies');
  const companyId = companies.body.companies[0].id;
  console.log(`✅ Company ID: ${companyId}\n`);

  // Endpoint tests
  const tests = [
    // Companies
    { name: 'Get Company', path: `/api/companies/${companyId}`, method: 'GET' },
    
    // Documents
    { name: 'List Documents', path: `/api/companies/${companyId}/documents`, method: 'GET' },
    { name: 'Get Document', path: `/api/companies/${companyId}/documents/1`, method: 'GET' },
    
    // Links
    { name: 'List Links', path: `/api/companies/${companyId}/links`, method: 'GET' },
    
    // Tasks
    { name: 'List Tasks', path: `/api/companies/${companyId}/tasks`, method: 'GET' },
    { name: 'Get Task', path: `/api/companies/${companyId}/tasks/1`, method: 'GET' },
    
    // Conversations
    { name: 'List Conversations', path: `/api/companies/${companyId}/conversations`, method: 'GET' },
    { name: 'Get Conversation', path: `/api/conversations/13910`, method: 'GET' },
    { name: 'List Messages', path: `/api/conversations/13910/messages`, method: 'GET' },
    
    // Agents
    { name: 'List Agents', path: `/api/companies/${companyId}/agents`, method: 'GET' },
    { name: 'Get Agent', path: `/api/agents/38`, method: 'GET' },
    
    // Executions
    { name: 'List Executions', path: `/api/companies/${companyId}/executions`, method: 'GET' },
    { name: 'Get Execution', path: `/api/executions/225300`, method: 'GET' },
    
    // Cycles
    { name: 'Get Cycle Status', path: `/api/companies/${companyId}/cycle`, method: 'GET' },
    { name: 'List Cycles', path: `/api/companies/${companyId}/cycles`, method: 'GET' },
    
    // User/Auth
    { name: 'Get User Profile', path: '/api/me', method: 'GET' },
    { name: 'Get User Settings', path: '/api/user/settings', method: 'GET' },
    { name: 'Get Session', path: '/api/session', method: 'GET' },
    
    // Integrations
    { name: 'Twitter Status', path: `/api/companies/${companyId}/twitter/status`, method: 'GET' },
    { name: 'Ads Status', path: `/api/companies/${companyId}/ads/status`, method: 'GET' },
    { name: 'Outreach Status', path: `/api/companies/${companyId}/outreach/status`, method: 'GET' },
    
    // Dashboard
    { name: 'Dashboard Data', path: `/api/companies/${companyId}/dashboard`, method: 'GET' },
    { name: 'Recent Activity', path: `/api/companies/${companyId}/activity`, method: 'GET' },
    
    // Billing
    { name: 'Billing Info', path: '/api/billing', method: 'GET' },
    { name: 'Subscription', path: '/api/subscription', method: 'GET' },
    
    // Settings
    { name: 'Company Settings', path: `/api/companies/${companyId}/settings`, method: 'GET' },
    { name: 'Update Company', path: `/api/companies/${companyId}`, method: 'PUT', body: { name: 'Test Update' } }
  ];

  for (const test of tests) {
    console.log(`Testing: ${test.name}`);
    console.log(`${test.method} ${test.path}`);
    
    try {
      const response = await req(test.path, test.method, test.body);
      console.log(`  Status: ${response.status}`);
      
      if (response.status === 200) {
        console.log(`  ✅ Success`);
        // Save schema sample
        if (typeof response.body === 'object' && response.body !== null) {
          const sampleKeys = Object.keys(response.body).slice(0, 5);
          console.log(`  Keys: ${sampleKeys.join(', ')}${Object.keys(response.body).length > 5 ? '...' : ''}`);
        }
      } else {
        console.log(`  ❌ ${response.status} - ${response.body.message || 'Error'}`);
      }
      
      results.endpoints.push({
        name: test.name,
        path: test.path,
        method: test.method,
        status: response.status,
        success: response.status === 200,
        responseKeys: typeof response.body === 'object' && response.body !== null ? Object.keys(response.body) : [],
        headers: response.headers
      });
      
      // Save full response for successful requests
      if (response.status === 200 && typeof response.body === 'object') {
        const schemaKey = test.name.toLowerCase().replace(/\s+/g, '_');
        results.schemas[schemaKey] = response.body;
      }
      
    } catch (e) {
      console.log(`  ❌ ERROR: ${e.message}`);
      results.endpoints.push({
        name: test.name,
        path: test.path,
        method: test.method,
        error: e.message
      });
    }
    
    console.log('');
    
    // Rate limit protection
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Error handling tests
  console.log('\n🚨 Error Handling Tests\n');
  console.log('───────────────────────\n');
  
  const errorTests = [
    { name: '404 Not Found', path: '/api/nonexistent', expected: 404 },
    { name: 'Invalid Company ID', path: '/api/companies/99999999', expected: 404 },
    { name: 'Invalid Task ID', path: `/api/companies/${companyId}/tasks/99999999`, expected: 404 },
    { name: 'Malformed Request', path: `/api/companies/${companyId}`, method: 'PUT', body: { invalid: 123 }, expected: 400 }
  ];

  for (const test of errorTests) {
    console.log(`${test.name}: ${test.method || 'GET'} ${test.path}`);
    
    try {
      const response = await req(test.path, test.method || 'GET', test.body);
      console.log(`  Status: ${response.status} ${response.status === test.expected ? '✅' : '❌'}`);
      console.log(`  Body: ${JSON.stringify(response.body)}`);
      
      results.endpoints.push({
        name: `Error: ${test.name}`,
        path: test.path,
        method: test.method || 'GET',
        status: response.status,
        expected: test.expected,
        body: response.body
      });
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }
    
    console.log('');
  }

  // Save results
  const outputPath = '/Users/bizmatehub/.openclaw/workspace-phat/research/data/day-3-api-inventory.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Results saved to: ${outputPath}\n`);

  // Summary
  const working = results.endpoints.filter(e => e.success).length;
  const total = results.endpoints.length;
  
  console.log('═══════════════════════════════════════');
  console.log('📊 Summary');
  console.log('═══════════════════════════════════════\n');
  console.log(`Total Endpoints Tested: ${total}`);
  console.log(`Working Endpoints: ${working}`);
  console.log(`Failed/Not Found: ${total - working}`);
  console.log(`Schemas Captured: ${Object.keys(results.schemas).length}\n`);
  
  console.log('Working Endpoints:');
  results.endpoints
    .filter(e => e.success)
    .forEach(e => console.log(`  ✅ ${e.method} ${e.path}`));
  
  console.log('\nFailed Endpoints:');
  results.endpoints
    .filter(e => !e.success && e.status !== undefined)
    .forEach(e => console.log(`  ❌ ${e.method} ${e.path} (${e.status})`));
  
  console.log('\n✅ Day 3 API Inventory Complete!\n');
}

probe().catch(console.error);
