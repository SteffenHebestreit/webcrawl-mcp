import { getStringEnv } from './utils';

/**
 * Model Context Protocol server configuration settings
 */
export const mcpConfig = {
  mcpName: getStringEnv('MCP_NAME', 'Crawl4AI-MCP'),
  mcpVersion: getStringEnv('MCP_VERSION', '1.0.0'),
  mcpDescription: getStringEnv('MCP_DESCRIPTION', 'MCP Server for Crawl4AI'),
};