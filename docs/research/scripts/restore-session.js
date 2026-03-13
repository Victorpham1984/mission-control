// Restore Polsia session from saved auth
const fs = require('fs');
const auth = JSON.parse(fs.readFileSync('/Users/bizmatehub/.openclaw/workspace/state/polsia-auth.json', 'utf8'));

// Current company: 13563 (RunHive)
localStorage.setItem('currentCompanyId', '13563');
localStorage.setItem('darkMode', 'false');
localStorage.setItem('dashboard_sections_v1', '["cycle","wallet","business","recent","reports","tasks","documents","links"]');

console.log('Session restored! Company ID:', localStorage.getItem('currentCompanyId'));
