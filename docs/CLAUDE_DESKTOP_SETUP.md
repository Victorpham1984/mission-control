# Claude Desktop Setup for CommandMate MCP

Connect CommandMate to Claude Desktop so you can manage tasks, query agents, and search your workspace knowledge using natural language.

## 1) Overview

Model Context Protocol (MCP) is a standard that lets AI clients (like Claude Desktop) securely connect to external tools and data sources. In this case, MCP allows Claude to talk to your CommandMate workspace.

Once connected, you can ask Claude to do real work in CommandMate for you — like creating tasks, approving workflow items, querying specialized agents, or searching your knowledge base. You can do this in plain language without switching tabs.

This guide is written for first-time setup, including non-technical users. Follow the steps in order and you should be up and running in about 5–10 minutes. ✅

## 2) Prerequisites

Before setup, make sure you have:

- **Claude Desktop installed**
  - Download: <https://claude.ai/download>
- **A CommandMate account and API key**
  - In CommandMate: **Settings → API Keys → Generate New Key**
  - Your key should start with `cm_`
- **Basic terminal/text editor familiarity**
  - You only need this to open and edit one JSON config file

> ⚠️ **Important:** Keep your API key private. Anyone with this key may be able to access your workspace actions.

## 3) Step-by-Step Setup

### Step 1: Locate your Claude Desktop config file

Use the path for your operating system:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

If the file does not exist yet, create it.

### Step 2: Get your CommandMate API key

1. Log in to CommandMate.
2. Go to **Settings → API Keys**.
3. Click **Generate New Key**.
4. Copy the key to a safe place.

> ⚠️ **Important:** Your API key should start with `cm_`. If it doesn’t, double-check that you copied the correct value.

### Step 3: Edit `claude_desktop_config.json`

Open the file in any text editor and add this configuration:

```json
{
  "mcpServers": {
    "commandmate": {
      "command": "npx",
      "args": ["-y", "@commandmate/mcp-server"],
      "env": {
        "COMMANDMATE_API_KEY": "cm_your_actual_api_key_here",
        "COMMANDMATE_API_URL": "https://mission-control-sable-three.vercel.app/api/v1"
      }
    }
  }
}
```

If you already have other MCP servers configured, keep them and only add the `commandmate` entry under `mcpServers`.

### Step 4: Save and restart Claude Desktop

1. Save the JSON file.
2. Quit Claude Desktop completely (not just close window).
3. Open Claude Desktop again.

Claude should initialize the MCP server on startup.

### Step 5: Verify the connection

In Claude Desktop, try:

```text
List my CommandMate tasks
```

If connected, Claude should return your task list. 🎯

### Step 6: Try a create action

Now test a write action:

```text
Create a task to review Q2 product roadmap
```

You should receive a success response with a task ID or task object.

### Step 7: Confirm resource access

Try reading a resource directly:

```text
Show me commandmate://tasks
```

If you get structured data back, your setup is fully working.

## 4) Available Tools (7)

These are the tools exposed by the CommandMate MCP server.

### 1. `create_task`
- **What it does:** Creates a new task in CommandMate.
- **Example prompt:** `Hey Claude, create a task to research top 5 competitors.`
- **Expected response:** Confirmation with created task details (typically task ID, title, status).

### 2. `list_tasks`
- **What it does:** Lists tasks in your workspace.
- **Example prompt:** `List my CommandMate tasks.`
- **Expected response:** Array/list of tasks with summary fields (ID, title, status, assignee/created time when available).

### 3. `get_task`
- **What it does:** Fetches details for one task by ID.
- **Example prompt:** `Get task details for task 123.`
- **Expected response:** Single task object with richer metadata (description, status, timestamps, related fields).

### 4. `approve_task`
- **What it does:** Approves a pending task.
- **Example prompt:** `Approve task #123.`
- **Expected response:** Success confirmation and updated task status.

### 5. `reject_task`
- **What it does:** Rejects a pending task.
- **Example prompt:** `Reject task #123 with reason: missing acceptance criteria.`
- **Expected response:** Confirmation plus updated status/reason where supported.

### 6. `query_agent`
- **What it does:** Sends a question/request to a specific CommandMate agent.
- **Example prompt:** `Ask the research agent about market size for SaaS onboarding tools.`
- **Expected response:** Agent-generated answer (usually structured text and/or references).

### 7. `search_knowledge`
- **What it does:** Searches workspace knowledge/documents.
- **Example prompt:** `Search for documentation about API rate limits.`
- **Expected response:** Ranked list of relevant docs/snippets, often with titles and excerpts.

## 5) Available Resources (4)

You can also ask Claude to read MCP resources directly:

1. `commandmate://tasks` — All tasks
2. `commandmate://agents` — All agents
3. `commandmate://knowledge` — Workspace documents/knowledge
4. `commandmate://tasks/{id}` — Task details for a specific task

Example prompts:

- `Show me commandmate://tasks`
- `What is in commandmate://agents?`
- `What’s in commandmate://knowledge?`
- `Open commandmate://tasks/123`

## 6) Example Workflows

### Workflow 1: Create and approve a task

```text
You: "Create a task to write a blog post about AI trends"
Claude: [creates task, returns task ID]
You: "Approve task #123"
Claude: [approves task, confirms]
```

### Workflow 2: Query an agent

```text
You: "Ask the research agent about market size for SaaS tools"
Claude: [queries agent, returns response]
```

### Workflow 3: Search knowledge base

```text
You: "Search for documentation about API rate limits"
Claude: [searches knowledge, returns relevant docs]
```

## 7) Troubleshooting

### ❌ “MCP server not found”
- Confirm the config file path is correct for your OS.
- Confirm JSON syntax is valid (no trailing commas).
- Fully restart Claude Desktop.

### ❌ “Authentication failed”
- Verify `COMMANDMATE_API_KEY` is correct and starts with `cm_`.
- Generate a new key and try again.

### ❌ “Connection timeout”
- Verify `COMMANDMATE_API_URL` is reachable:
  - `https://mission-control-sable-three.vercel.app/api/v1`
- Check your network/firewall settings.

### ❌ “Tool not found”
- Make sure you’re using the latest server package:

```bash
npx -y @commandmate/mcp-server
```

- Restart Claude Desktop after updating.

## 8) Next Steps

- Quick 5-minute guide: [MCP Quickstart](./MCP_QUICKSTART.md)
- Broader setup & architecture notes: [MCP Setup Guide](./MCP_SETUP_GUIDE.md)
- Full API docs: `MCP_API_REFERENCE.md` (coming soon)
- Support: CommandMate support/Discord (internal support channel)
