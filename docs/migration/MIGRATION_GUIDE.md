# CommandMate Pivot: Mac mini → MacBook Pro Migration Guide
## Option A: "Polsia for Vietnamese SMEs"

**Created:** 2026-03-12 15:00 ICT  
**Owner:** Đệ 🐾 + Sếp Victor  
**Goal:** Setup MacBook Pro for CommandMate pivot development (VSCode + Claude Code Max)

---

## 📋 Tổng Quan

**Current State:**
- **Mac mini:** Production repo at `/Users/bizmatehub/Projects/mission-control`
- **GitHub:** `git@github.com:Victorpham1984/mission-control.git`
- **Deploy:** Vercel (https://mission-control-sable-three.vercel.app)
- **Database:** Supabase (production data)
- **Codebase:** ~14,173 lines (Next.js 15 + Supabase + MCP)

**Target State:**
- **MacBook Pro:** Development environment (VSCode + Claude Code Max)
- **Workflow:** Code on MacBook → Push to GitHub → Auto-deploy Vercel
- **Database:** Use Supabase production (read-only mode during dev)
- **Architecture:** Pivot to business-first UI (CEO dashboard, onboarding, playbooks)

---

## 🚀 Phase 1: MacBook Pro Setup (30-45 phút)

### Step 1: Install Core Tools

**Terminal commands:**

```bash
# 1. Install Homebrew (nếu chưa có)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Install Node.js (v22+)
brew install node@22
echo 'export PATH="/opt/homebrew/opt/node@22/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# 3. Verify versions
node --version  # Should be v22.x
npm --version   # Should be 10.x+

# 4. Install Git (nếu chưa có)
brew install git

# 5. Configure Git
git config --global user.name "Victor Pham"
git config --global user.email "victor@bizmatehub.com"  # Use your actual email

# 6. Install pnpm (package manager)
npm install -g pnpm

# 7. Verify
pnpm --version  # Should be 9.x+
```

---

### Step 2: Setup SSH Key for GitHub

**Generate SSH key:**

```bash
# 1. Generate new SSH key
ssh-keygen -t ed25519 -C "victor@bizmatehub.com"
# Press Enter 3 times (default location, no passphrase)

# 2. Start SSH agent
eval "$(ssh-agent -s)"

# 3. Add key to agent
ssh-add ~/.ssh/id_ed25519

# 4. Copy public key to clipboard
cat ~/.ssh/id_ed25519.pub | pbcopy
```

**Add to GitHub:**
1. Open https://github.com/settings/keys
2. Click "New SSH key"
3. Title: `MacBook Pro - CommandMate Dev`
4. Paste key from clipboard
5. Click "Add SSH key"

**Test connection:**
```bash
ssh -T git@github.com
# Should see: "Hi Victorpham1984! You've successfully authenticated..."
```

---

### Step 3: Clone Repository

**Choose location:**

```bash
# Option A: ~/Projects (same as Mac mini)
mkdir -p ~/Projects
cd ~/Projects

# Option B: ~/Code (if you prefer)
mkdir -p ~/Code
cd ~/Code

# Clone repo
git clone git@github.com:Victorpham1984/mission-control.git commandmate-pivot

# Enter directory
cd commandmate-pivot

# Check branches
git branch -a
```

**Expected output:**
```
* main
  remotes/origin/dev
  remotes/origin/main
  remotes/origin/feature/phase-2b-frontend
```

---

### Step 4: Install Dependencies

```bash
# Install all packages
pnpm install

# Wait 2-3 minutes for download + install
# Should see ~500+ packages installed
```

---

### Step 5: Setup Environment Variables

**Copy secrets from Mac mini:**

**On Mac mini (current session), run:**
```bash
cd ~/Projects/mission-control
cat .env.local
```

**Copy output to MacBook Pro:**

```bash
# On MacBook Pro
cd ~/Projects/commandmate-pivot  # Or wherever you cloned

# Create .env.local
nano .env.local

# Paste these values (get from Mac mini):
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENCLAW_GATEWAY_URL=http://localhost:3000
OPENCLAW_GATEWAY_TOKEN=your-token-here
YOUTUBE_API_KEY=AIza...
OPENROUTER_API_KEY=sk-or-...
ADMIN_PASSWORD=your-admin-password
CRON_SECRET=your-cron-secret

# Save: Ctrl+O, Enter, Ctrl+X
```

**Security check:**
```bash
# Verify .env.local is gitignored
cat .gitignore | grep ".env.local"
# Should see: .env.local

# Verify file exists but NOT tracked
git status
# Should NOT see .env.local in "Changes to be committed"
```

---

### Step 6: Test Local Development

```bash
# Start dev server
pnpm dev

# Should start on http://localhost:3000
# Open browser and verify site loads
```

**Verify:**
- ✅ Home page loads (no errors)
- ✅ Supabase connection works (check browser console)
- ✅ No build errors in terminal

**Stop server:**
```
Ctrl+C
```

---

### Step 7: Install VSCode + Claude Code Max

**Install VSCode:**
1. Download from https://code.visualstudio.com/
2. Drag to Applications folder
3. Open VSCode

**Install extensions:**
```bash
# Open command palette: Cmd+Shift+P
# Type: "Shell Command: Install 'code' command in PATH"
# Click to install

# Install extensions via terminal
code --install-extension GitHub.copilot
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
code --install-extension Prisma.prisma
```

**Install Claude Code Max (Anthropic):**
1. Open VSCode Extensions panel (Cmd+Shift+X)
2. Search: "Claude Code"
3. Install "Claude Code Max" by Anthropic
4. Sign in with Anthropic account
5. Configure API key (if needed)

**Open project:**
```bash
cd ~/Projects/commandmate-pivot
code .
```

---

## 💾 Phase 2: Database Backup Strategy

### Current Database: Supabase Production

**Tables (from schema):**
- `users` - User accounts
- `workspaces` - User workspaces
- `workspace_members` - Membership data
- `agents` - MCP agents
- `mcp_servers` - MCP server configs
- `mcp_tools` - Available tools
- `tasks` - Agent tasks
- `webhooks` - Webhook configs

### Backup Strategy

**Option A: Use Supabase Dashboard (Recommended)**

1. Go to https://supabase.com/dashboard
2. Select project: `mission-control`
3. Go to: Database → Backups
4. Click "Create Backup" → Wait 2-3 minutes
5. Download backup file (SQL format)
6. Save to: `~/Backups/commandmate-backup-2026-03-12.sql`

**Option B: CLI Backup (Alternative)**

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref

# Create backup
supabase db dump -f ~/Backups/commandmate-backup-2026-03-12.sql

# Verify file
ls -lh ~/Backups/commandmate-backup-2026-03-12.sql
```

### Development Database Strategy

**Recommended: Keep using production Supabase during pivot**

**Why:**
- Avoid data sync issues
- Faster development (no local Postgres setup)
- Easy rollback if pivot fails

**Safety measures:**
1. **Read-only mode during development:**
   ```typescript
   // Add to lib/supabaseClient.ts
   const DEV_MODE = process.env.NODE_ENV === 'development';
   
   // Wrap mutations in dev check
   if (DEV_MODE && !confirmMutation) {
     console.warn('⚠️ Mutation blocked in dev mode');
     return;
   }
   ```

2. **Use feature flags for new UI:**
   ```typescript
   // app/dashboard/page.tsx
   const BUSINESS_UI = process.env.NEXT_PUBLIC_BUSINESS_UI === 'true';
   
   return BUSINESS_UI ? <CEODashboard /> : <TechDashboard />;
   ```

3. **Branch strategy:**
   - `main` = production (current MCP-focused UI)
   - `pivot/business-os` = new branch for pivot work
   - Keep both alive until pivot proven

---

## 🏗️ Phase 3: New Architecture (Pivot to Business-First)

### Current Architecture (MCP-focused)

```
┌─────────────────────────────────────────┐
│         Next.js 15 Frontend             │
│  (Agent-centric UI: servers, tools)     │
├─────────────────────────────────────────┤
│         API Routes                      │
│  /api/v1/mcp/*  (MCP operations)        │
│  /api/auth/*    (Supabase auth)         │
├─────────────────────────────────────────┤
│         Supabase                        │
│  (users, workspaces, mcp_servers, etc.) │
└─────────────────────────────────────────┘
```

**Pages:**
- `/dashboard` - Agent management (tech-focused)
- `/agents` - MCP agent list
- `/tools` - MCP tool catalog
- `/settings` - Config (agent-centric)

---

### New Architecture (Business OS Pivot)

```
┌────────────────────────────────────────────┐
│         Next.js 15 Frontend                │
│  (Business-first UI: goals, KPIs, etc.)   │
├────────────────────────────────────────────┤
│  🆕 CEO Dashboard                          │
│  - Company health overview                 │
│  - Revenue, KPIs, Bottlenecks              │
│  - Next 24h action plan                    │
├────────────────────────────────────────────┤
│  🆕 Onboarding Wizard                      │
│  - 5-min magic setup                       │
│  - Auto-generate: landing, email, tasks    │
│  - Instant value delivery                  │
├────────────────────────────────────────────┤
│  🆕 Playbook Library                       │
│  - E-commerce SaaS (COSMATE template)      │
│  - Content Creator                         │
│  - B2B Lead Gen                            │
├────────────────────────────────────────────┤
│         API Routes                         │
│  /api/business/* (new business endpoints)  │
│  /api/v1/mcp/*   (keep for backend)        │
├────────────────────────────────────────────┤
│         Supabase (Extended Schema)         │
│  🆕 companies, goals, kpis, playbooks     │
│  (keep existing: users, workspaces, etc.)  │
└────────────────────────────────────────────┘
```

**New Pages:**
- `/` - Landing page (Vietnamese, SEA-focused)
- `/onboarding` - 5-min wizard (company → ICP → playbook → launch)
- `/ceo` - CEO Dashboard (health, KPIs, actions)
- `/playbooks` - Template library (install & customize)
- `/apps` - Installed playbooks (e.g., "E-commerce OS")
- `/settings/billing` - Pricing & usage (action-based)

---

### Database Schema Changes (Extend, Don't Replace)

**New tables to add:**

```sql
-- Companies (business entity)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id),
  name TEXT NOT NULL,
  mission TEXT,
  icp_segment TEXT,  -- 'creator' | 'sme' | 'agency'
  industry TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goals (business objectives)
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  title TEXT NOT NULL,
  target_value DECIMAL,
  current_value DECIMAL,
  unit TEXT,  -- 'MRR' | 'users' | 'leads'
  deadline DATE,
  status TEXT DEFAULT 'active',  -- 'active' | 'completed' | 'paused'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- KPIs (key performance indicators)
CREATE TABLE kpis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,
  category TEXT,  -- 'acquisition' | 'activation' | 'revenue' | 'operations'
  current_value DECIMAL,
  target_value DECIMAL,
  unit TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playbooks (pre-built templates)
CREATE TABLE playbooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,  -- 'ecommerce' | 'content' | 'b2b'
  config JSONB,  -- Skills, cron jobs, KPI structure
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Installed Playbooks (company-specific)
CREATE TABLE installed_playbooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  playbook_id UUID REFERENCES playbooks(id),
  customization JSONB,
  active BOOLEAN DEFAULT true,
  installed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Actions (business operations log)
CREATE TABLE actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  action_type TEXT,  -- 'send_email' | 'post_social' | 'update_crm'
  description TEXT,
  success BOOLEAN,
  evidence JSONB,  -- Screenshots, links, metrics
  cost DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Keep existing tables:**
- `users` - Still needed for auth
- `workspaces` - Map to companies
- `mcp_servers` - Use as backend execution engine
- `mcp_tools` - Skills library for playbooks

---

### UI Component Structure

**New directories:**

```
src/
├── app/
│   ├── (business)/          # Business-first UI (new)
│   │   ├── layout.tsx       # Vietnamese UI, business nav
│   │   ├── page.tsx         # Landing page
│   │   ├── onboarding/
│   │   │   ├── page.tsx     # 5-min wizard
│   │   │   └── steps/       # Step components
│   │   ├── ceo/
│   │   │   ├── page.tsx     # CEO dashboard
│   │   │   ├── health.tsx   # Company health widget
│   │   │   ├── kpis.tsx     # KPI board
│   │   │   └── actions.tsx  # Next 24h plan
│   │   ├── playbooks/
│   │   │   ├── page.tsx     # Template library
│   │   │   ├── [id].tsx     # Playbook detail
│   │   │   └── install.tsx  # Install flow
│   │   └── apps/
│   │       ├── page.tsx     # Installed playbooks
│   │       └── [id]/        # App dashboard
│   │
│   ├── (tech)/              # Tech UI (keep for backend)
│   │   ├── dashboard/       # Old MCP dashboard
│   │   ├── agents/
│   │   └── tools/
│   │
│   └── api/
│       ├── business/        # New business endpoints
│       │   ├── companies/
│       │   ├── goals/
│       │   ├── kpis/
│       │   ├── playbooks/
│       │   └── actions/
│       └── v1/mcp/          # Keep existing MCP API
│
├── components/
│   ├── business/            # Business UI components
│   │   ├── CompanyHealth.tsx
│   │   ├── KPICard.tsx
│   │   ├── ActionLog.tsx
│   │   └── PlaybookCard.tsx
│   └── tech/                # Tech UI (keep)
│
└── lib/
    ├── playbooks/           # Playbook templates
    │   ├── ecommerce-saas.ts
    │   ├── content-creator.ts
    │   └── b2b-leadgen.ts
    └── actions/             # Action handlers
        ├── email.ts
        ├── social.ts
        └── crm.ts
```

---

### Feature Flags (Gradual Rollout)

**Environment variables:**

```bash
# .env.local
NEXT_PUBLIC_BUSINESS_UI=true          # Enable business UI
NEXT_PUBLIC_TECH_UI=true              # Keep tech UI (for debugging)
NEXT_PUBLIC_ONBOARDING_WIZARD=true    # Enable 5-min wizard
NEXT_PUBLIC_CEO_DASHBOARD=true        # Enable CEO dashboard
NEXT_PUBLIC_PLAYBOOKS=true            # Enable playbook library
```

**Code example:**

```typescript
// app/layout.tsx
const BUSINESS_UI = process.env.NEXT_PUBLIC_BUSINESS_UI === 'true';

export default function RootLayout({ children }) {
  return (
    <html lang={BUSINESS_UI ? 'vi' : 'en'}>
      <body>
        {BUSINESS_UI ? <BusinessNav /> : <TechNav />}
        {children}
      </body>
    </html>
  );
}
```

---

## 🔄 Phase 4: Development Workflow

### Branch Strategy

```bash
# Mac mini (current production)
main              # Keep stable, current MCP version
  ├── dev         # Tech features (MCP integration)

# MacBook Pro (pivot work)
pivot/business-os # New branch for pivot
  ├── pivot/onboarding
  ├── pivot/ceo-dashboard
  └── pivot/playbooks
```

**Create pivot branch:**

```bash
# On MacBook Pro
cd ~/Projects/commandmate-pivot

# Create new branch from main
git checkout main
git pull origin main
git checkout -b pivot/business-os

# Push to GitHub
git push -u origin pivot/business-os
```

---

### Development Loop

**On MacBook Pro:**

```bash
# 1. Start dev server
pnpm dev

# 2. Edit files in VSCode
# Use Claude Code Max for AI-assisted coding

# 3. Test changes locally
# Open http://localhost:3000

# 4. Commit changes
git add .
git commit -m "feat: Add CEO dashboard wireframe"

# 5. Push to GitHub
git push origin pivot/business-os
```

**Deploy strategy:**

**Option A: Separate Vercel project (Recommended)**
- Create new Vercel project: `commandmate-pivot`
- Connect to branch: `pivot/business-os`
- URL: `https://commandmate-pivot.vercel.app`
- Keep production stable: `https://mission-control-sable-three.vercel.app`

**Option B: Same project, preview deployment**
- Push to `pivot/business-os` → Auto-preview URL
- Only merge to `main` when pivot ready to replace production

---

### Code Review with Claude

**VSCode shortcuts with Claude Code Max:**

```
Cmd+K    Ask Claude (inline)
Cmd+L    Explain code
Cmd+I    Generate code from prompt
Cmd+E    Edit selection with AI
```

**Example prompts:**

1. "Convert this MCP agent dashboard to a business-first CEO dashboard with Vietnamese UI"
2. "Generate Supabase schema migration for adding companies, goals, and KPIs tables"
3. "Build a 5-step onboarding wizard component with form validation and progress bar"
4. "Create a playbook template for e-commerce SaaS with pre-configured skills and cron jobs"

---

## 📦 Phase 5: Backup & Safety

### Git Backup Strategy

**Auto-backup script:**

```bash
# Create backup script
nano ~/backup-commandmate.sh

# Paste this:
#!/bin/bash
DATE=$(date +%Y-%m-%d-%H%M)
BACKUP_DIR=~/Backups/commandmate
mkdir -p $BACKUP_DIR

# Backup code
cd ~/Projects/commandmate-pivot
git bundle create $BACKUP_DIR/repo-$DATE.bundle --all

# Backup .env
cp .env.local $BACKUP_DIR/env-$DATE.txt

# Backup database (if using local)
# supabase db dump -f $BACKUP_DIR/db-$DATE.sql

echo "✅ Backup complete: $BACKUP_DIR/repo-$DATE.bundle"

# Save: Ctrl+O, Enter, Ctrl+X

# Make executable
chmod +x ~/backup-commandmate.sh

# Run manually
~/backup-commandmate.sh

# Or schedule daily (optional)
crontab -e
# Add line: 0 2 * * * ~/backup-commandmate.sh
```

---

### Rollback Plan

**If pivot fails:**

```bash
# 1. Switch back to main branch
git checkout main

# 2. Verify production still works
pnpm dev

# 3. Delete pivot branch (if needed)
git branch -D pivot/business-os
git push origin --delete pivot/business-os

# 4. Restore database from backup (if modified)
supabase db reset
psql -f ~/Backups/commandmate-backup-2026-03-12.sql
```

---

## ⏱️ Timeline

### Week 1: Setup + Wireframe (March 12-19)
- ✅ Day 1: MacBook Pro setup (this guide)
- 📋 Day 2-3: Database schema design + migration
- 🎨 Day 4-5: CEO dashboard wireframe (no backend)
- 📝 Day 6-7: Onboarding wizard UI mockup

### Week 2: Backend + Integration (March 19-26)
- 🔧 Day 1-2: API endpoints (companies, goals, KPIs)
- 🔌 Day 3-4: Connect CEO dashboard to Supabase
- ✨ Day 5-6: Onboarding wizard backend (artifact generation)
- 🧪 Day 7: Testing + bug fixes

### Week 3: Playbooks + Polish (March 26 - April 2)
- 📚 Day 1-3: Build first playbook (E-commerce SaaS from COSMATE)
- 🎀 Day 4-5: UI polish + Vietnamese localization
- 📊 Day 6: Action-based tracking (log business operations)
- 🚀 Day 7: Internal beta test

### Week 4: Beta Launch (April 2-9)
- 👥 Day 1-2: Invite 5 beta users (Vietnamese SMEs)
- 📈 Day 3-5: Collect feedback + iterate
- 🐛 Day 6: Bug fixes + performance
- 🎉 Day 7: Public launch prep

---

## 📞 Support & Troubleshooting

### Common Issues

**1. `pnpm install` fails**
```bash
# Clear cache
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

**2. Supabase connection error**
```bash
# Verify .env.local values
cat .env.local | grep SUPABASE

# Test connection
pnpm dev
# Open browser → check console for errors
```

**3. Git push rejected**
```bash
# Force push (only on pivot branch, NOT main!)
git push origin pivot/business-os --force
```

**4. Port 3000 already in use**
```bash
# Kill process
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 pnpm dev
```

---

## 🎯 Success Criteria

**Setup complete when:**
- ✅ VSCode + Claude Code Max installed
- ✅ Repo cloned, dependencies installed
- ✅ `pnpm dev` runs without errors
- ✅ Can edit files, see live reload
- ✅ Git push works to `pivot/business-os` branch
- ✅ Database backup created
- ✅ Ready to start building CEO dashboard

---

## 📚 Next Steps After Setup

**Immediate (Day 1):**
1. ✅ Complete this setup guide
2. 📸 Screenshot: VSCode open with repo
3. 🧪 Test: Edit `app/page.tsx`, see live reload
4. 💬 Confirm with Sếp: "Setup xong, ready to pivot!"

**Day 2 onwards:**
1. 📋 Design database schema (companies, goals, KPIs)
2. 🎨 Wireframe CEO dashboard (Vietnamese UI)
3. ⚡ Build onboarding wizard (5-min magic)
4. 📦 Create first playbook template (COSMATE → E-commerce SaaS)

---

## 🆘 Need Help?

**Ask Đệ in Telegram:**
- "Bị lỗi X khi setup"
- "Cần giải thích thêm về Y"
- "Hướng khác để làm Z"

**Or spawn tech squad:**
- Kiến 🏗️ (Frontend) - UI components, React/Next.js
- Thép ⚙️ (Backend) - API, database, Supabase

---

**Ready to start? Execute Phase 1 steps now! 🚀**
