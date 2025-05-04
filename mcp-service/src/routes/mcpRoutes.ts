import { Router, Request, Response } from 'express';
import { SimpleMcpServer } from '../mcp/SimpleMcpServer';
import config from '../config';
import { createLogger } from '../utils/logger';

export function setupMcpRoutes(mcpServer: SimpleMcpServer): Router {
  const router = Router();
  const logger = createLogger('MCP-Routes');

  // Set up the SSE endpoint for MCP
  router.post('/', async (req: Request, res: Response) => {
    logger.info('Received MCP SSE request');

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Flush headers immediately

    try {
      // Pass request and response to the MCP server handler
      await mcpServer.handleHttpRequest(req, res);

      // Keep connection open for SSE, but handle client close
      req.on('close', () => {
        logger.info('Client disconnected from MCP SSE');
        // Perform any necessary cleanup here
        res.end(); // Ensure response is ended when client disconnects
      });
    } catch (error) {
      logger.error('Error handling MCP SSE request:', error);
      // Check if headers were already sent before sending error
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error during SSE setup',
          },
          id: (req.body && req.body.id) || null, // Try to get request ID
        });
      } else {
        // If headers sent, we might only be able to close the connection
        res.end();
      }
    }
  });

  // Handle GET requests to the SSE endpoint
  router.get('/', (req: Request, res: Response) => {
    logger.warn('Invalid GET request received at MCP SSE endpoint');
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method Not Allowed. Use POST for MCP SSE connection."
      },
      id: null
    });
  });

  return router;
}