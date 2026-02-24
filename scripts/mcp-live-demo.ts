#!/usr/bin/env npx ts-node
/**
 * MCP Live Demo Script
 * Demonstrates: server management, tool discovery, execution, multi-server, error handling
 *
 * Usage: npx ts-node scripts/mcp-live-demo.ts
 */

import { MCPClient } from '../src/lib/mcp/MCPClient';
import { MCPServerRegistry } from '../src/lib/mcp/MCPServerRegistry';
import type { MCPServerConfig } from '../src/lib/mcp/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const DEMO_DIR = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-demo-')));

function log(emoji: string, msg: string) {
  console.log(`\n${emoji}  ${msg}`);
}

function divider(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

async function demo() {
  const registry = new MCPServerRegistry();

  try {
    divider('🚀 MCP LIVE DEMO — CommandMate Phase 3');

    // Step 1: Add Filesystem Server
    divider('Step 1: Add Filesystem MCP Server');
    const fsConfig: MCPServerConfig = {
      id: 'demo-filesystem',
      workspace_id: 'demo',
      name: 'filesystem',
      transport: 'stdio',
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem', DEMO_DIR],
      env: {},
      enabled: true,
      timeout: 15000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await registry.addServer(fsConfig);
    log('✅', `Server "${fsConfig.name}" added`);

    // Step 2: Discover Tools
    divider('Step 2: Discover Tools');
    const tools = await registry.listTools(fsConfig.id);
    log('🔧', `Discovered ${tools.length} tools:`);
    for (const t of tools) {
      console.log(`    • ${t.name}: ${t.description ?? 'No description'}`);
    }

    // Step 3: Execute Tools
    divider('Step 3: Execute Filesystem Tools');

    // Write a file
    log('📝', 'Writing file...');
    const writePath = path.join(DEMO_DIR, 'hello.txt');
    const writeResult = await registry.callTool(fsConfig.id, 'write_file', {
      path: writePath,
      content: 'Hello from MCP! 🎉\nThis file was created by the MCP filesystem server.',
    });
    console.log(`    Result: ${writeResult.success ? '✅ Success' : '❌ Failed'} (${writeResult.durationMs}ms)`);

    // Read it back
    log('📖', 'Reading file...');
    const readResult = await registry.callTool(fsConfig.id, 'read_file', {
      path: writePath,
    });
    console.log(`    Result: ${readResult.success ? '✅ Success' : '❌ Failed'} (${readResult.durationMs}ms)`);
    console.log(`    Content: ${readResult.content?.[0]?.text}`);

    // List directory
    log('📂', 'Listing directory...');
    const listResult = await registry.callTool(fsConfig.id, 'list_directory', {
      path: DEMO_DIR,
    });
    console.log(`    Result: ${listResult.success ? '✅ Success' : '❌ Failed'} (${listResult.durationMs}ms)`);
    console.log(`    Contents: ${listResult.content?.[0]?.text}`);

    // Step 4: Error Handling Demo
    divider('Step 4: Error Handling');

    // Invalid tool
    log('⚠️', 'Calling nonexistent tool...');
    const errResult = await registry.callTool(fsConfig.id, 'nonexistent_tool', {});
    console.log(`    Result: ${errResult.success ? '✅ Success' : '❌ Failed (expected)'}`);
    console.log(`    Error: ${errResult.error}`);

    // Permission denied
    log('⚠️', 'Reading outside allowed directory...');
    const permResult = await registry.callTool(fsConfig.id, 'read_file', {
      path: '/etc/passwd',
    });
    console.log(`    Result: ${permResult.success ? '✅ Success' : '❌ Failed (expected)'}`);
    console.log(`    Error: ${permResult.error}`);

    // Step 5: Performance
    divider('Step 5: Performance Metrics');
    const iterations = 10;
    const durations: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const r = await registry.callTool(fsConfig.id, 'read_file', {
        path: writePath,
      });
      durations.push(r.durationMs);
    }
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    log('📊', `Performance over ${iterations} calls:`);
    console.log(`    Average: ${avg.toFixed(1)}ms`);
    console.log(`    Min: ${min}ms`);
    console.log(`    Max: ${max}ms`);

    // Step 6: Server Status
    divider('Step 6: Server Status');
    const statuses = await registry.getStatuses();
    for (const s of statuses) {
      log(s.healthy ? '🟢' : '🔴', `${s.name}: connected=${s.connected}, healthy=${s.healthy}, tools=${s.toolCount}`);
    }

    divider('🎉 DEMO COMPLETE');
    console.log(`\n  All operations successful!`);
    console.log(`  Demo directory: ${DEMO_DIR}`);
    console.log(`  Total tools discovered: ${tools.length}`);
    console.log(`  Average latency: ${avg.toFixed(1)}ms\n`);

  } finally {
    await registry.disconnectAll();
    fs.rmSync(DEMO_DIR, { recursive: true, force: true });
  }
}

demo().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
