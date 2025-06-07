import express, { Express, Request, Response } from 'express';
import { Server as HttpServer } from 'http';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import config from '../config';
import { SimpleMcpServer } from '../mcp/SimpleMcpServer';
import { ResourceController } from '../controllers/resourceController';
import { ToolController } from '../controllers/toolController';
import { CrawlExecutionService } from '../services/crawlExecutionService';
import { setupMcpRoutes } from '../routes/mcpRoutes';
import { setupMcpStreamableRoutes } from '../routes/mcpStreamableRoutes';
import { setupApiRoutes } from '../routes/apiRoutes';
import { createLogger } from '../utils/logger';
import { requestLoggerMiddleware, errorLoggerMiddleware } from '../utils/requestLogger';

/**
 * Unified Server - Configures and manages the Express application
 * with integrated MCP server capabilities
 */
export class Server {
  private app: Express;
  private httpServer?: HttpServer;
  private mcpServer: SimpleMcpServer;
  private resourceController: ResourceController;
  private toolController: ToolController;
  private crawlExecutor: CrawlExecutionService;
  private logger = createLogger('Server');

  constructor() {
    this.app = express();

    // Instantiate services and controllers
    this.crawlExecutor = new CrawlExecutionService();
    this.resourceController = new ResourceController(config);
    this.toolController = new ToolController(config, this.crawlExecutor);

    // Instantiate the MCP server
    this.mcpServer = new SimpleMcpServer(config);    // Register tools with the MCP server instance    this.mcpServer.tool(this.toolController.getCrawlToolConfig());
    this.mcpServer.tool(this.toolController.getMarkdownCrawlToolConfig());
    this.mcpServer.tool(this.toolController.getSearchInPageToolConfig());    this.mcpServer.tool(this.toolController.getSmartCrawlToolConfig());
    this.mcpServer.tool(this.toolController.getExtractLinksToolConfig());
    this.mcpServer.tool(this.toolController.getSitemapGeneratorToolConfig());
    this.mcpServer.tool(this.toolController.getWebSearchToolConfig());
    this.mcpServer.tool(this.toolController.getDateTimeToolConfig());

    // Register resources with the MCP server instance
    this.mcpServer.resource(this.resourceController.getInfoResourceConfig());

    // Setup middleware and routes
    this.configureMiddleware();
    this.configureRoutes();
  }
  /**
   * Configure Express application middleware
   */
  private configureMiddleware(): void {
    this.app.use(requestLoggerMiddleware);
    
    // Request timeout middleware for long-running operations
    this.app.use((req: Request, res: Response, next) => {
      const requestTimeout = config.get('requestTimeout');
      req.setTimeout(requestTimeout, () => {
        this.logger.warn(`Request timeout after ${requestTimeout}ms for ${req.method} ${req.url}`);
        if (!res.headersSent) {
          res.status(408).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Request timeout - operation took too long to complete',
            },
            id: null
          });
        }
      });
      next();
    });
    
    // Security headers
    this.app.use(helmet());

    // Logging
    this.app.use(morgan('combined')); // Or 'dev' for shorter logs

    // Parse JSON bodies with dynamic size limit
    this.app.use(express.json({ limit: config.get('maxRequestSize') }));

    // Enable CORS with dynamic origins
    let corsOrigins: string | string[] = config.get('corsOrigins');
    if (typeof corsOrigins === 'string' && corsOrigins !== '*') {
        corsOrigins = corsOrigins.split(',').map(origin => origin.trim());
    }
    this.app.use(cors({ origin: corsOrigins }));

    // Apply rate limiting
    const limiter = rateLimit({
      windowMs: config.get('rateLimitWindow'),
      max: config.get('rateLimitMaxRequests'),
    });
    this.app.use(limiter);
  }
  /**
   * Set up all application routes
   */
   private configureRoutes(): void {
    // Mount API routes
    this.app.use('/api', setupApiRoutes());
    
    // Mount MCP routes - both legacy SSE and modern Streamable HTTP
    this.app.use('/mcp/sse', setupMcpRoutes(this.mcpServer)); // Legacy SSE at /mcp/sse
    this.app.use('/mcp', setupMcpStreamableRoutes(this.mcpServer)); // Modern Streamable HTTP at /mcp
    
    // Mount tools routes under /mcp for better MCP integration
    this.app.use('/mcp', setupApiRoutes()); // This adds /mcp/tools, /mcp/health, /mcp/version
    
    // Optional: Add a 404 handler for undefined routes
    this.app.use((req: Request, res: Response) => {
        res.status(404).json({ error: 'Not Found' });
    });

    // Error logging middleware
    this.app.use(errorLoggerMiddleware);
  }
  /**
   * Start the server
   * @param port The port to listen on (overrides config if provided)
   */
  public start(port?: number): void {
    const serverPort = port || config.get('port');
    
    // Create HTTP server instance
    this.httpServer = this.app.listen(serverPort, () => {
      this.logger.info(`${config.get('mcpName')} is running on port ${serverPort}`);
      this.logger.info(`=== MCP ENDPOINTS ===`);
      this.logger.info(`MCP SSE connection: GET http://localhost:${serverPort}/mcp/sse`);
      this.logger.info(`MCP SSE messages: POST http://localhost:${serverPort}/mcp/messages`);
      this.logger.info(`MCP Streamable HTTP (recommended): POST http://localhost:${serverPort}/mcp`);
      this.logger.info(`=== API ENDPOINTS ===`);
      this.logger.info(`Health check: GET http://localhost:${serverPort}/api/health`);
      this.logger.info(`Version info: GET http://localhost:${serverPort}/api/version`);
      this.logger.info(`Tools listing: GET http://localhost:${serverPort}/api/tools`);
      this.logger.info(`Direct crawl tool: POST http://localhost:${serverPort}/api/tools/crawl`);
      this.logger.info(`Direct markdown crawl: POST http://localhost:${serverPort}/api/tools/crawlWithMarkdown`);
      this.logger.info(`=== MCP-INTEGRATED ENDPOINTS ===`);
      this.logger.info(`MCP tools listing: GET http://localhost:${serverPort}/mcp/tools`);
      this.logger.info(`MCP health check: GET http://localhost:${serverPort}/mcp/health`);
      this.logger.info(`MCP version info: GET http://localhost:${serverPort}/mcp/version`);
    });

    // Configure HTTP server timeouts for long-running operations
    if (this.httpServer) {
      const serverTimeout = config.get('serverTimeout');
      const keepAliveTimeout = config.get('keepAliveTimeout'); 
      const headersTimeout = config.get('headersTimeout');
      
      this.httpServer.timeout = serverTimeout; // Overall request timeout
      this.httpServer.keepAliveTimeout = keepAliveTimeout; // Keep-alive timeout
      this.httpServer.headersTimeout = headersTimeout; // Headers timeout
      
      this.logger.info(`HTTP server timeouts configured:`);
      this.logger.info(`  - Server timeout: ${serverTimeout}ms (${serverTimeout/1000}s)`);
      this.logger.info(`  - Keep-alive timeout: ${keepAliveTimeout}ms (${keepAliveTimeout/1000}s)`);
      this.logger.info(`  - Headers timeout: ${headersTimeout}ms (${headersTimeout/1000}s)`);
    }
  }
  /**
   * Get the Express app instance
   */
  public getApp(): express.Application {
    return this.app;
  }

  /**
   * Get the HTTP server instance
   */
  public getHttpServer(): HttpServer | undefined {
    return this.httpServer;
  }

  /**
   * Gracefully shutdown the server
   */
  public async shutdown(): Promise<void> {
    if (this.httpServer) {
      return new Promise((resolve, reject) => {
        this.httpServer!.close((err) => {
          if (err) {
            this.logger.error('Error closing HTTP server:', err);
            reject(err);
          } else {
            this.logger.info('HTTP server closed gracefully');
            resolve();
          }
        });
      });
    }
  }
}