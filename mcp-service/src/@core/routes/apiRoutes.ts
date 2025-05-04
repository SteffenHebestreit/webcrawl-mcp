import { Express, Request, Response } from 'express';
import { createLogger } from '../utils/logger.js';
import configManager from '../config/configManager.js';

const logger = createLogger('apiRoutes');

/**
 * Setup API routes for general service information
 * @param app Express application
 */
export function setupApiRoutes(app: Express): void {
  logger.info('Setting up API routes');
  
  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    logger.debug('Health check request received');
    res.status(200).json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  });
  
  // Service information endpoint
  app.get('/info', (req, res) => {
    res.status(200).json({
      name: configManager.get('mcpName'),
      version: configManager.get('mcpVersion'),
      description: configManager.get('mcpDescription'),
      environment: configManager.get('environment'),
    });
  });
  
  // API documentation endpoint (could serve Swagger/OpenAPI docs)
  app.get('/api-docs', (req, res) => {
    res.status(200).json({
      message: 'API documentation',
      mcp: {
        sse: '/mcp/sse',
        streamable: '/mcp/streamable',
        documentation: 'https://github.com/microsoft/modelcontextprotocol/blob/main/specification/protocol.md'
      },
      api: {
        health: '/health',
        info: '/info'
      }
    });
  });
}