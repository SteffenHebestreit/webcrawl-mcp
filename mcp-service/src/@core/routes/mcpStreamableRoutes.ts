import { Express } from 'express';
import { CoreMcpServer } from '../mcp/CoreMcpServer.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('mcpStreamableRoutes');

/**
 * Setup MCP routes for streamable HTTP
 * @param app Express application
 * @param mcpServer MCP server instance
 */
export function setupMcpStreamableRoutes(app: Express, mcpServer: CoreMcpServer): void {
  logger.info('Setting up MCP streamable routes');
  
  // MCP endpoint for streamable HTTP
  app.post('/mcp/streamable', (req, res) => {
    // Set headers for streaming response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Handle the MCP request
    mcpServer.handleStreamableHttpRequest(req, res).catch((error) => {
      logger.error('Error in MCP streamable route:', error);
    });
  });
  
  // MCP endpoint for GET (connection initialization)
  app.get('/mcp/streamable', (req, res) => {
    // Set headers for streaming response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Handle the MCP request (initialization only)
    mcpServer.handleStreamableHttpRequest(req, res).catch((error) => {
      logger.error('Error in MCP streamable initialization route:', error);
    });
  });
}