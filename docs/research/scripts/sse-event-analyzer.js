#!/usr/bin/env node
/**
 * SSE Event Analyzer for Polsia
 * Connects to SSE stream, captures events, triggers actions, analyzes patterns
 */

const https = require('https');
const fs = require('fs');

// Load auth
const authPath = '/Users/bizmatehub/.openclaw/workspace/state/polsia-auth.json';
const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
const sessionCookie = auth.cookies.find(c => c.name === 'polsia_session')?.value;

if (!sessionCookie) {
  console.error('❌ No polsia_session cookie found');
  process.exit(1);
}

const companyId = 13563;
const outputDir = '../data/sse-captures';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

// Event collectors
const events = [];
const eventTypes = new Set();
let connectionStart = Date.now();

console.log('🔌 Connecting to SSE stream...');
console.log(`📁 Output: ${outputDir}/events-${timestamp}.json`);
console.log('---\n');

// Connect to SSE
const options = {
  hostname: 'polsia.com',
  path: `/api/executions/stream?companyId=${companyId}`,
  method: 'GET',
  headers: {
    'Cookie': `polsia_session=${sessionCookie}`,
    'Accept': 'text/event-stream'
  }
};

const req = https.request(options, (res) => {
  console.log(`✅ Connected: ${res.statusCode} ${res.statusMessage}`);
  console.log(`📡 Headers:`, JSON.stringify(res.headers, null, 2));
  console.log('\n📨 Events:\n');

  let buffer = '';
  let eventCount = 0;

  res.on('data', (chunk) => {
    buffer += chunk.toString();
    
    // Process complete SSE messages
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || ''; // Keep incomplete message

    lines.forEach(message => {
      if (!message.trim()) return;

      const dataMatch = message.match(/^data: (.+)$/m);
      if (dataMatch) {
        try {
          const event = JSON.parse(dataMatch[1]);
          eventCount++;
          
          const type = event.type || 'unknown';
          eventTypes.add(type);
          
          const timestamp = new Date().toISOString();
          const latency = Date.now() - connectionStart;
          
          events.push({
            timestamp,
            latency,
            type,
            size: dataMatch[1].length,
            data: event
          });

          console.log(`[${eventCount}] ${timestamp} | Type: ${type} | Size: ${dataMatch[1].length}b | Latency: ${latency}ms`);
          
          // Pretty print key fields
          if (event.type === 'sync') {
            console.log(`   → cycleRunning: ${event.cycleRunning}, runningAgents: ${event.runningAgents?.length || 0}`);
          } else if (event.type === 'agent_started') {
            console.log(`   → agent: ${event.agentName || event.agent_name}, task: ${event.taskId}`);
          } else if (event.type === 'thinking_stream') {
            const preview = event.content?.slice(0, 60).replace(/\n/g, ' ') || '';
            console.log(`   → ${preview}...`);
          }

        } catch (e) {
          console.error('❌ Parse error:', e.message);
          console.error('   Raw:', dataMatch[1].slice(0, 200));
        }
      }
    });
  });

  res.on('end', () => {
    saveResults();
  });
});

req.on('error', (e) => {
  console.error('❌ Connection error:', e.message);
  process.exit(1);
});

req.end();

// Save results on exit
process.on('SIGINT', () => {
  console.log('\n\n⏸️  Interrupted. Saving results...\n');
  saveResults();
  process.exit(0);
});

// Auto-disconnect after 60 seconds
setTimeout(() => {
  console.log('\n⏱️  60 second timeout. Saving results...\n');
  saveResults();
  process.exit(0);
}, 60000);

function saveResults() {
  const summary = {
    captureStart: new Date(connectionStart).toISOString(),
    captureEnd: new Date().toISOString(),
    duration: Date.now() - connectionStart,
    eventCount: events.length,
    eventTypes: Array.from(eventTypes).sort(),
    avgSize: Math.round(events.reduce((sum, e) => sum + e.size, 0) / events.length),
    avgLatency: Math.round(events.reduce((sum, e) => sum + e.latency, 0) / events.length),
    events
  };

  const outPath = `${outputDir}/events-${timestamp}.json`;
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  
  console.log(`\n📊 Summary:`);
  console.log(`   Events captured: ${summary.eventCount}`);
  console.log(`   Event types: ${summary.eventTypes.join(', ')}`);
  console.log(`   Avg size: ${summary.avgSize} bytes`);
  console.log(`   Avg latency: ${summary.avgLatency}ms`);
  console.log(`   Duration: ${Math.round(summary.duration / 1000)}s`);
  console.log(`\n✅ Saved: ${outPath}`);
}
