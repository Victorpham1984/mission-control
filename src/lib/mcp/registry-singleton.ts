/**
 * Shared MCPServerRegistry singleton
 * All API routes use this single instance to avoid duplicate connections.
 */

import { MCPServerRegistry } from './MCPServerRegistry';

let instance: MCPServerRegistry | null = null;

export function getSharedRegistry(): MCPServerRegistry {
  if (!instance) {
    instance = new MCPServerRegistry();
  }
  return instance;
}
