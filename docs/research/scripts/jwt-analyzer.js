#!/usr/bin/env node
/**
 * JWT Token Analyzer
 * Decodes and analyzes Polsia session token
 */

const fs = require('fs');
const https = require('https');

// Load auth
const authPath = '/Users/bizmatehub/.openclaw/workspace/state/polsia-auth.json';
const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
const sessionCookie = auth.cookies.find(c => c.name === 'polsia_session')?.value;

if (!sessionCookie) {
  console.error('❌ No polsia_session cookie found');
  process.exit(1);
}

console.log('🔍 JWT TOKEN ANALYSIS');
console.log('='.repeat(80));
console.log('');

// Session cookie analysis
console.log('📝 SESSION COOKIE');
console.log('-'.repeat(80));

const sessionData = auth.cookies.find(c => c.name === 'polsia_session');
console.log(`Value length: ${sessionData.value.length} chars`);
console.log(`Domain: ${sessionData.domain}`);
console.log(`Path: ${sessionData.path}`);
console.log(`Expires: ${sessionData.expires === -1 ? 'Session' : new Date(sessionData.expires * 1000).toISOString()}`);
console.log(`HttpOnly: ${sessionData.httpOnly}`);
console.log(`Secure: ${sessionData.secure}`);
console.log(`SameSite: ${sessionData.sameSite}`);

if (sessionData.expires !== -1) {
  const now = Date.now() / 1000;
  const lifetime = sessionData.expires - now;
  const days = Math.floor(lifetime / 86400);
  console.log(`Time to expiry: ${days} days (~${Math.round(days / 7)} weeks)`);
}

console.log('');

// Check if it's a JWT (starts with eyJ)
if (sessionCookie.startsWith('eyJ')) {
  console.log('🔐 JWT TOKEN STRUCTURE');
  console.log('-'.repeat(80));
  
  const parts = sessionCookie.split('.');
  console.log(`Parts: ${parts.length} (${parts.length === 3 ? 'valid JWT' : 'invalid JWT'})`);
  
  if (parts.length >= 2) {
    try {
      // Decode header
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      console.log('\nHeader:');
      console.log(JSON.stringify(header, null, 2));
      
      // Decode payload
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      console.log('\nPayload:');
      console.log(JSON.stringify(payload, null, 2));
      
      // Analyze payload
      if (payload.exp) {
        const exp = new Date(payload.exp * 1000);
        const now = new Date();
        const lifetime = (exp - now) / 1000 / 86400;
        console.log(`\nExpiry: ${exp.toISOString()} (~${Math.round(lifetime)} days)`);
      }
      
      if (payload.iat) {
        const iat = new Date(payload.iat * 1000);
        console.log(`Issued: ${iat.toISOString()}`);
      }
      
    } catch (e) {
      console.error('❌ Failed to decode JWT:', e.message);
    }
  }
} else {
  console.log('⚠️  Not a JWT token (doesn\'t start with eyJ)');
  console.log('Likely a session ID or opaque token');
  console.log('');
  console.log('Token preview:');
  console.log(sessionCookie.slice(0, 50) + '...');
}

console.log('');
console.log('='.repeat(80));

// Test auth endpoints
console.log('');
console.log('🔑 AUTHENTICATION ENDPOINTS TEST');
console.log('-'.repeat(80));

async function testEndpoint(path, withAuth = false) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'polsia.com',
      path,
      method: 'GET',
      headers: withAuth ? { 'Cookie': `polsia_session=${sessionCookie}` } : {}
    };
    
    const req = https.request(options, (res) => {
      resolve({ status: res.statusCode, headers: res.headers });
    });
    
    req.on('error', () => resolve({ status: 'ERROR', headers: {} }));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ status: 'TIMEOUT', headers: {} });
    });
    req.end();
  });
}

(async () => {
  // Test protected endpoint without auth
  console.log('\n1. Protected endpoint WITHOUT auth:');
  const unauthResult = await testEndpoint('/api/companies/13563', false);
  console.log(`   GET /api/companies/13563 → ${unauthResult.status}`);
  
  // Test with auth
  console.log('\n2. Protected endpoint WITH auth:');
  const authResult = await testEndpoint('/api/companies/13563', true);
  console.log(`   GET /api/companies/13563 → ${authResult.status}`);
  
  // Test logout endpoint
  console.log('\n3. Logout endpoint (if exists):');
  const logoutResult = await testEndpoint('/api/auth/logout', true);
  console.log(`   GET /api/auth/logout → ${logoutResult.status}`);
  
  const logoutPost = await testEndpoint('/api/logout', true);
  console.log(`   GET /api/logout → ${logoutPost.status}`);
  
  // Test session endpoint
  console.log('\n4. Session endpoint (if exists):');
  const sessionResult = await testEndpoint('/api/session', true);
  console.log(`   GET /api/session → ${sessionResult.status}`);
  
  const meResult = await testEndpoint('/api/me', true);
  console.log(`   GET /api/me → ${meResult.status}`);
  
  console.log('');
  console.log('✅ Authentication analysis complete!');
})();
