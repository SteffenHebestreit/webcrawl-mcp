import express from 'express';
import { Request, Response } from 'express';
import { ConfigService } from '../services/configService';
import { SimpleMcpServer } from '../mcp/SimpleMcpServer';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

/**
 * ExpressServer - Configures and manages the Express application
 * for the MCP server
 */
export class ExpressServer {
  private app: express.Application;
  private mcpServer: SimpleMcpServer;
  private config: ConfigService;

  constructor(mcpServer: SimpleMcpServer, config: ConfigService) {
    this.app = express();
    this.mcpServer = mcpServer;
    this.config = config;
    this.configureApp();
    this.setupRoutes();
  }

  /**
   * Configure Express application middleware
   */
  private configureApp(): void {
    // Parse JSON bodies with dynamic size limit
    this.app.use(express.json({ limit: this.config.get('maxRequestSize') }));
    
    // Enable CORS with dynamic origins
    const origins = this.config.get('corsOrigins') as string[];
    this.app.use(cors({ origin: origins }));
    
    // Apply rate limiting
    const limiter = rateLimit({
      windowMs: this.config.get('rateLimitWindow'),
      max: this.config.get('rateLimitMaxRequests')
    });
    this.app.use(limiter);
  }

  /**
   * Set up Express routes
   */
  private setupRoutes(): void {
    // Set up the SSE endpoint for MCP
    this.app.post('/mcp/sse', async (req: Request, res: Response) => {
      console.log('Received MCP SSE request');
      
      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      try {
        await this.mcpServer.handleHttpRequest(req, res);
      } catch (error) {
        console.error('Error handling MCP SSE request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
      }
    });

    // Set up other HTTP methods for the MCP endpoint to return proper errors
    this.app.get('/mcp/sse', (req: Request, res: Response) => {
      console.log('Received GET MCP request');
      res.status(405).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed"
        },
        id: null
      });
    });

    // Add a basic health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).send('OK');
    });
    
    // Add version info endpoint
    this.app.get('/version', (req: Request, res: Response) => {
      res.status(200).json({
        name: this.config.get('mcpName'),
        version: this.config.get('mcpVersion'),
        description: this.config.get('mcpDescription')
      });
    });
  }

  /**
   * Start the Express server
   * @param port The port to listen on (overrides config if provided)
   */
  public start(port?: number): void {
    const serverPort = port || this.config.get('port');
    const crawlServiceUrl = this.config.get('crawlServiceUrl');
    
    this.app.listen(serverPort, () => {
      console.log(`${this.config.get('mcpName')} is running on port ${serverPort}`);
      console.log(`MCP SSE endpoint available at: http://localhost:${serverPort}/mcp/sse`);
      console.log(`Connecting to Crawl4AI service at: ${crawlServiceUrl}`);
    });
  }

  /**
   * Get the Express app instance
   */
  public getApp(): express.Application {
    return this.app;
  }
}