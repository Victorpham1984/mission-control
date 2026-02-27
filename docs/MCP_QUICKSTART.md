# CommandMate MCP Quickstart (5 Minutes)

Get CommandMate working with any MCP-compatible client (like Claude Desktop) in just a few minutes.

## 1) What is CommandMate MCP?

CommandMate MCP lets your AI client securely connect to CommandMate’s task system, agents, and knowledge base.

In practice: you can ask Claude (or another MCP client) to create tasks, query agents, and search documents using plain language.

## 2) Quick Install (3 Steps)

### Step 1: Install the MCP server (1 min)

```bash
# Option A: Install globally
npm install -g @commandmate/mcp-server

# Option B: Run with npx (no global install)
npx -y @commandmate/mcp-server
```

> ✅ **Tip:** `npx -y` is the fastest way to try it without changing your global setup.

### Step 2: Get your API key (1 min)

1. Log in to CommandMate.
2. Open **Settings → API Keys**.
3. Click **Generate**.
4. Copy the API key.

> ⚠️ **Important:** The key should start with `cm_`.

### Step 3: Configure your client (2 min)

For Claude Desktop, add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "commandmate": {
      "command": "npx",
      "args": ["-y", "@commandmate/mcp-server"],
      "env": {
        "COMMANDMATE_API_KEY": "cm_your_key_here",
        "COMMANDMATE_API_URL": "https://mission-control-sable-three.vercel.app/api/v1"
      }
    }
  }
}
```

Restart Claude Desktop, then you’re done. 🎯

## 3) Test It (1 min)

In Claude Desktop:

```text
You: "List my CommandMate tasks"
Claude: [shows your tasks]
```

If you use an MCP CLI client:

```bash
mcp-client call commandmate list_tasks
```

## 4) What You Can Do

### 7 Tools available

- `create_task` — create a task
- `list_tasks` — list tasks
- `get_task` — get task details
- `approve_task` — approve pending task
- `reject_task` — reject pending task
- `query_agent` — ask an agent
- `search_knowledge` — search workspace docs

### 4 Resources available

- `commandmate://tasks`
- `commandmate://agents`
- `commandmate://knowledge`
- `commandmate://tasks/{id}`

## 5) Next Steps

- Full walkthrough: [Claude Desktop Setup](./CLAUDE_DESKTOP_SETUP.md)
- Broader technical setup: [MCP Setup Guide](./MCP_SETUP_GUIDE.md)
- Implementation examples: [Week 1 Final Report](./WEEK1_FINAL_REPORT.md)
- API reference: `MCP_API_REFERENCE.md` (coming soon)
