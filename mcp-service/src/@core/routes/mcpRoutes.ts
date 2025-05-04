import { Express } from 'express';
import { CoreMcpServer } from '../mcp/CoreMcpServer.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('mcpRoutes');

/**
 * Setup MCP routes for SSE connection
 * @param app Express application
 * @param mcpServer MCP server instance
 */
export function setupMcpRoutes(app: Express, mcpServer: CoreMcpServer): void {
  logger.info('Setting up MCP routes');
  
  // MCP endpoint for Server-Sent Events (SSE)
  app.post('/mcp/sse', (req, res) => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Handle the MCP request
    mcpServer.handleHttpRequest(req, res).catch((error) => {
      logger.error('Error in MCP SSE route:', error);
    });
  });
  
  // MCP endpoint for GET (connection initialization)
  app.get('/mcp/sse', (req, res) => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Handle the MCP request (initialization only)
    mcpServer.handleHttpRequest(req, res).catch((error) => {
      logger.error('Error in MCP SSE initialization route:', error);
    });
  });
}