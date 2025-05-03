import { Router, Request, Response } from 'express';
import { SimpleMcpServer } from '../mcp/SimpleMcpServer';
import config from '../config';
import { createLogger } from '../utils/logger';

/**
 * Set up routes for MCP using the modern Streamable HTTP approach instead of SSE
 */
export function setupMcpStreamableRoutes(mcpServer: SimpleMcpServer): Router {
  const router = Router();
  const logger = createLogger('MCP-Streamable');

  // Set up the primary MCP endpoint for JSON-RPC over Streamable HTTP
  router.post('/', async (req: Request, res: Response) => {
    logger.info('Received MCP Streamable HTTP request');

    // Set headers for Streamable HTTP
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Transfer-Encoding', 'chunked');

    try {
      // Pass request and response to the MCP server handler
      await mcpServer.handleStreamableHttpRequest(req, res);

      // Handle client disconnect
      req.on('close', () => {
        logger.info('Client disconnected from MCP Streamable HTTP');
        // Ensure response is properly closed
        if (!res.writableEnded) {
          res.end();
        }
      });
    } catch (error) {
      logger.error('Error handling MCP Streamable HTTP request:', error);
      
      // If headers haven't been sent, send proper error response
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error during MCP request',
          },
          id: (req.body && req.body.id) || null,
        });
      } else if (!res.writableEnded) {
        // If headers were sent but response not ended, write error as chunk and end
        try {
          const errorChunk = JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error during MCP request',
            },
            id: (req.body && req.body.id) || null,
          });
          res.write(errorChunk);
          res.end();
        } catch (e) {
          logger.error('Failed to write error chunk:', e);
          res.end();
        }
      }
    }
  });

  return router;
}