#!/usr/bin/env node
/**
 * Trigger actions to generate SSE events
 */

const https = require('https');
const fs = require('fs');

const authPath = '/Users/bizmatehub/.openclaw/workspace/state/polsia-auth.json';
const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
const sessionCookie = auth.cookies.find(c => c.name === 'polsia_session')?.value;

if (!sessionCookie) {
  console.error('❌ No polsia_session cookie found');
  process.exit(1);
}

const companyId = 13563;

function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
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
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function main() {
  console.log('🎬 Triggering SSE events...\n');

  // 1. Send a chat message (should trigger agent response)
  console.log('1️⃣  Sending chat message to trigger agent...');
  
  const chatResult = await apiRequest('POST', '/api/chat', {
    companyId,
    message: 'Test for SSE research: What is the current time? (no need to execute, just respond)',
    conversationId: null
  });

  console.log(`   Status: ${chatResult.status}`);
  if (chatResult.data.success) {
    console.log(`   ✅ Message sent`);
    console.log(`   Response: ${chatResult.data.response?.slice(0, 100)}...`);
  } else {
    console.log(`   ⚠️  Response: ${JSON.stringify(chatResult.data).slice(0, 200)}`);
  }

  console.log('\n2️⃣  Checking for available test endpoints...');
  
  // Try to get conversations
  const convResult = await apiRequest('GET', `/api/companies/${companyId}/conversations`);
  console.log(`   /conversations: ${convResult.status}`);

  // Try to get tasks
  const tasksResult = await apiRequest('GET', `/api/companies/${companyId}/tasks`);
  console.log(`   /tasks: ${tasksResult.status}`);

  console.log('\n✅ Done. Watch the SSE analyzer for events!\n');
  console.log('Expected events:');
  console.log('  - agent_started');
  console.log('  - thinking_stream');
  console.log('  - agent_response');
  console.log('  - execution_complete');
}

main().catch(console.error);
