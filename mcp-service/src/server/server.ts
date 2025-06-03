import express, { Express, Request, Response } from 'express';
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
    this.mcpServer = new SimpleMcpServer(config);

    // Register tools with the MCP server instance
    this.mcpServer.tool(this.toolController.getCrawlToolConfig());
    this.mcpServer.tool(this.toolController.getMarkdownCrawlToolConfig());

    // Setup middleware and routes
    this.configureMiddleware();
    this.configureRoutes();
  }

  /**
   * Configure Express application middleware
   */
  private configureMiddleware(): void {
    this.app.use(requestLoggerMiddleware);
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
    this.app.use('/mcp/', setupMcpStreamableRoutes(this.mcpServer)); // Modern Streamable HTTP at /mcp/
    
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

    this.app.listen(serverPort, () => {
      this.logger.info(`${config.get('mcpName')} is running on port ${serverPort}`);
      this.logger.info(`MCP SSE endpoint (deprecated): http://localhost:${serverPort}/mcp/sse`);
      this.logger.info(`MCP Streamable HTTP endpoint (recommended): http://localhost:${serverPort}/mcp/v2`);
      this.logger.info(`Health check endpoint: http://localhost:${serverPort}/api/health`);
      this.logger.info(`Version info endpoint: http://localhost:${serverPort}/api/version`);
    });
  }

  /**
   * Get the Express app instance
   */
  public getApp(): express.Application {
    return this.app;
  }
}