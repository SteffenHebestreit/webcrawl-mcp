import { Router, Request, Response } from 'express';
import { SimpleMcpServer } from '../mcp/SimpleMcpServer';
import config from '../config';
import { createLogger } from '../utils/logger';

export function setupMcpRoutes(mcpServer: SimpleMcpServer): Router {
  const router = Router();
  const logger = createLogger('McpRoutes');

  // MCP SSE endpoint (following official pattern)
  // GET for SSE connection establishment
  router.get('/sse', (req: Request, res: Response) => {
    logger.info('SSE connection established');

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Send initial connection success
    res.write(
      `data: {"jsonrpc":"2.0","result":{"mcp":{"name":"WebCrawler-MCP","version":"1.0.0"}},"id":null}\n\n`
    );

    // Handle client disconnect
    req.on('close', () => {
      logger.info('SSE connection closed by client');
    });

    req.on('error', (error) => {
      logger.error('SSE connection error:', error);
    });
  });

  // POST for client-to-server messages (following official pattern)
  router.post('/messages', async (req: Request, res: Response) => {
    logger.info('MCP message received via POST');

    try {
      // Handle the JSON-RPC message
      await mcpServer.handleHttpRequest(req, res);
    } catch (error) {
      logger.error('Error handling MCP message:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: req.body?.id || null,
      });
    }
  });

  // Legacy: Keep the old POST /sse for backward compatibility
  router.post('/sse', (req: Request, res: Response) => {
    logger.warn(
      'Using deprecated POST /sse endpoint, please use GET /sse + POST /messages'
    );

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Handle the request with MCP server
    mcpServer.handleHttpRequest(req, res).catch((error) => {
      logger.error('Error in deprecated SSE handler:', error);
    });
  });

  return router;
}