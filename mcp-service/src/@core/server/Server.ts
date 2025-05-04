import express, { Express, json, urlencoded } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '../utils/logger.js';
import configManager from '../config/configManager.js';
import { CoreMcpServer } from '../mcp/CoreMcpServer.js';
import { ToolService } from '../services/ToolService.js';
import { join } from 'path';
import fs from 'fs';
// Import Joi for validation
import Joi from 'joi';

/**
 * Main server class that manages the Express application and MCP server
 */
export class Server {
  private app: Express;
  private logger = createLogger('Server');
  private mcpServer: CoreMcpServer;
  private services: Map<string, ToolService> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.app = express();
    this.mcpServer = new CoreMcpServer();
    this.configureMiddleware();
  }

  /**
   * Initialize the server asynchronously
   */
  public async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Properly await the async methods in the correct order
      await this.loadServices();
      this.configureTools();
      await this.loadRoutes();
      
      this.initialized = true;
      this.logger.info('Server initialized');
    } catch (error) {
      this.logger.error('Failed to initialize server:', error);
      throw error;
    }
  }

  /**
   * Configure Express middleware
   */
  private configureMiddleware(): void {
    // Basic Express middleware
    this.app.use(json({ limit: '10mb' }));
    this.app.use(urlencoded({ extended: true }));
    
    // Security middleware
    if (configManager.get('corsEnabled', false)) {
      this.app.use(cors({ 
        origin: configManager.get('corsOrigins', ['*']),
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
      }));
      this.logger.info('CORS enabled');
    }
    
    // Use helmet for security headers (with SSE compatibility)
    this.app.use(
      helmet({
        contentSecurityPolicy: false, // Disable CSP for SSE compatibility
      })
    );
    
    // Rate limiting middleware could be added here
    
    // Request logging
    this.app.use((req, res, next) => {
      this.logger.debug(`${req.method} ${req.url}`);
      next();
    });
  }

  /**
   * Dynamically load service modules from the services directory
   */
  private async loadServices(): Promise<void> {
    try {
      // Define paths to check for services
      const servicePaths = [
        // First try to load from mounted mcp-config services (for development)
        '/app/mcp-config/services',
        // Then try the services in the dist directory (copied during build)
        join(process.cwd(), 'dist', 'services'),
        // Finally fallback to the local services directory (when running locally)
        join(process.cwd(), 'src', 'services')
      ];
      
      let loadedServices = false;
      
      // Try each path in order
      for (const servicePath of servicePaths) {
        if (fs.existsSync(servicePath)) {
          this.logger.info(`Found services directory at ${servicePath}`);
          
          // Read directory for service files
          const files = fs.readdirSync(servicePath);
          const serviceFiles = files.filter(file => 
            (file.endsWith('.js') || file.endsWith('.ts')) && 
            file !== 'index.js' && file !== 'index.ts'
          );
          
          // Load each service
          for (const file of serviceFiles) {
            try {
              const modulePath = join(servicePath, file);
              this.logger.info(`Loading service from ${modulePath}`);
              
              // Dynamic import works differently based on ESM vs CommonJS and file paths
              // Since we're dealing with potential file system paths, we need to handle both scenarios
              let serviceModule;
              
              if (modulePath.endsWith('.ts')) {
                // For TypeScript files, use a relative import path when running locally
                const relativePath = modulePath
                  .replace(process.cwd(), '')
                  .replace(/\\/g, '/');
                serviceModule = await import(`.${relativePath}`);
              } else {
                // For JavaScript files (compiled in production/Docker), use the file URL
                const fileUrl = `file://${modulePath}`;
                serviceModule = await import(fileUrl);
              }
              
              // First check if this is a function-based service
              const serviceName = file.split('.')[0].toLowerCase();
              
              // Check if the module exports functions that match the tool names in tools.json
              const exportedFunctions = Object.keys(serviceModule)
                .filter(key => typeof serviceModule[key] === 'function');
              
              if (exportedFunctions.length > 0) {
                // Create a dynamic service adapter that will call the exported functions
                const dynamicService = this.createDynamicServiceAdapter(serviceName, serviceModule);
                
                await dynamicService.init(configManager);
                
                this.services.set(dynamicService.getName(), dynamicService);
                this.mcpServer.registerService(dynamicService.getName(), dynamicService);
                
                this.logger.info(`Loaded function-based service: ${dynamicService.getName()}`);
                loadedServices = true;
                continue;
              }
              
              // If not function-based, try the traditional class-based approach
              const className = file.split('.')[0];
              const ServiceClass = serviceModule[className] || 
                                   serviceModule[`${className}Service`] || 
                                   serviceModule.default;
              
              if (ServiceClass && typeof ServiceClass === 'function') {
                const service = new ServiceClass();
                
                // Check if it implements the ToolService interface
                if (typeof service.getName === 'function' && 
                    typeof service.init === 'function' &&
                    typeof service.shutdown === 'function') {
                  
                  await service.init(configManager);
                  
                  this.services.set(service.getName(), service);
                  this.mcpServer.registerService(service.getName(), service);
                  
                  this.logger.info(`Loaded class-based service: ${service.getName()}`);
                  loadedServices = true;
                } else {
                  this.logger.warn(`${file} does not implement the ToolService interface`);
                }
              } else {
                this.logger.warn(`Could not find service class in ${file}`);
              }
            } catch (error) {
              this.logger.error(`Error loading service ${file}:`, error);
            }
          }
          
          if (loadedServices) {
            // If we've successfully loaded services from this path, we can break
            break;
          }
        }
      }
      
      // If no services were loaded, fall back to the previous hard-coded approach
      if (!loadedServices) {
        this.logger.warn('No services were loaded from directories, falling back to direct import');
        
        try {
          // Import the CrawlService directly - Docker copies it to ./src/services/
          const { default: CrawlService } = await import('../../services/CrawlService.js');
          
          // Instantiate the service class
          const crawlService = new CrawlService();
          await crawlService.init(configManager);
          
          this.services.set(crawlService.getName(), crawlService);
          this.mcpServer.registerService(crawlService.getName(), crawlService);
          
          this.logger.info(`Loaded service: ${crawlService.getName()}`);
        } catch (directImportError) {
          this.logger.error('Failed to import services directly:', directImportError);
          throw new Error('No services could be loaded');
        }
      }
    } catch (error) {
      this.logger.error('Error loading services:', error);
      throw error;
    }
  }
  
  /**
   * Creates a dynamic service adapter that wraps exported functions
   * @param serviceName The name of the service
   * @param moduleExports The exported functions from the module
   * @returns A ToolService compatible object
   */
  private createDynamicServiceAdapter(serviceName: string, moduleExports: any): ToolService {
    const logger = createLogger(`DynamicService:${serviceName}`);
    
    // Create the dependencies object that will be passed to each function
    const dependencies = {
      createLogger: (name: string) => createLogger(`${serviceName}:${name}`),
      configManager,
      logger
    };
    
    // Create the service adapter
    const serviceAdapter: ToolService = {
      getName(): string {
        return serviceName;
      },
      
      async init(config: any): Promise<void> {
        logger.info(`Initializing dynamic service: ${serviceName}`);
        // If there's an init function in the module, call it
        if (typeof moduleExports.init === 'function') {
          await moduleExports.init(dependencies, config);
        }
      },
      
      async shutdown(): Promise<void> {
        logger.info(`Shutting down dynamic service: ${serviceName}`);
        // If there's a shutdown function in the module, call it
        if (typeof moduleExports.shutdown === 'function') {
          await moduleExports.shutdown(dependencies);
        }
      }
    };
    
    // Add all exported functions to the service adapter
    for (const [funcName, func] of Object.entries(moduleExports)) {
      if (typeof func === 'function' && funcName !== 'init' && funcName !== 'shutdown') {
        // @ts-ignore - Dynamically add method
        serviceAdapter[funcName] = async (...args: any[]) => {
          logger.debug(`Calling ${funcName} with args:`, args);
          try {
            // Call the function with dependencies and the original arguments
            return await func(dependencies, ...args);
          } catch (error) {
            logger.error(`Error in ${funcName}:`, error);
            throw error;
          }
        };
      }
    }
    
    return serviceAdapter;
  }

  /**
   * Configure tools based on configuration
   */
  private configureTools(): void {
    try {
      const toolsConfigPath = '/app/mcp-config/tools.json';
      
      // Check if the tools configuration file exists
      if (fs.existsSync(toolsConfigPath)) {
        const toolsConfig = JSON.parse(fs.readFileSync(toolsConfigPath, 'utf-8'));
        this.mcpServer.registerToolsFromConfig(toolsConfig);
        this.logger.info('Loaded tools configuration from file');
      } else {
        // If no file exists, use default configuration for crawl tools
        
        // Register the crawl tool
        this.mcpServer.registerTool({
          name: 'crawl',
          description: 'Crawl a website and extract text content and tables.',
          serviceName: 'crawl',
          methodName: 'executeCrawl',
          parameterDescription: 'URL to crawl along with optional crawling parameters like maxPages, depth, strategy, etc.',
          returnDescription: 'Object containing success status, original URL, extracted text content, optional tables, and optional error message.',
          parameters: Joi.object({
            url: Joi.string().uri().required().messages({'string.uri': 'Please provide a valid URL'}),
            maxPages: Joi.number().integer().min(1).optional(),
            depth: Joi.number().integer().min(0).optional(),
            strategy: Joi.string().valid("bfs", "dfs", "bestFirst").optional(),
            captureNetworkTraffic: Joi.boolean().optional(),
            captureScreenshots: Joi.boolean().optional(),
            waitTime: Joi.number().integer().min(0).optional()
          }),
          returns: Joi.object({
            success: Joi.boolean().required(),
            url: Joi.string().uri().required(),
            text: Joi.string().required(),
            tables: Joi.array().items(Joi.any()).optional(),
            error: Joi.string().optional()
          }),
          enabled: true
        });
        
        // Register the crawlWithMarkdown tool
        this.mcpServer.registerTool({
          name: 'crawlWithMarkdown',
          description: 'Crawl a website and return markdown-formatted content, potentially answering a specific query.',
          serviceName: 'crawl',
          methodName: 'executeCrawlWithMarkdown',
          parameterDescription: 'URL to crawl, optional crawling parameters, and an optional query.',
          returnDescription: 'Object containing success status, original URL, markdown content, and optional error message.',
          parameters: Joi.object({
            url: Joi.string().uri().required().messages({'string.uri': 'Please provide a valid URL'}),
            maxPages: Joi.number().integer().min(1).optional(),
            depth: Joi.number().integer().min(0).optional(),
            strategy: Joi.string().valid("bfs", "dfs", "bestFirst").optional(),
            query: Joi.string().optional()
          }),
          returns: Joi.object({
            success: Joi.boolean().required(),
            url: Joi.string().uri().required(),
            markdown: Joi.string().required(),
            error: Joi.string().optional()
          }),
          enabled: true
        });
        
        this.logger.info('Registered default tools configuration');
      }
    } catch (error) {
      this.logger.error('Error configuring tools:', error);
    }
  }

  /**
   * Load route modules
   */
  private async loadRoutes(): Promise<void> {
    try {
      // Import routes dynamically
      const { setupMcpRoutes } = await import('../routes/mcpRoutes.js');
      const { setupMcpStreamableRoutes } = await import('../routes/mcpStreamableRoutes.js');
      const { setupApiRoutes } = await import('../routes/apiRoutes.js');
      
      // Configure routes
      setupMcpRoutes(this.app, this.mcpServer);
      setupMcpStreamableRoutes(this.app, this.mcpServer);
      setupApiRoutes(this.app);
      
      this.logger.info('Routes initialized');
    } catch (error) {
      this.logger.error('Error loading routes:', error);
    }
  }

  /**
   * Start the server
   */
  public start(port: number = configManager.get('port', 3000)): void {
    this.app.listen(port, () => {
      this.logger.info(`Server running on port ${port}`);
    });
  }

  /**
   * Get the Express application instance
   */
  public getApp(): Express {
    return this.app;
  }

  /**
   * Graceful shutdown 
   */
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down server...');
    
    // Shutdown all services
    for (const [name, service] of this.services.entries()) {
      try {
        await service.shutdown();
        this.logger.info(`Service ${name} shutdown completed`);
      } catch (error) {
        this.logger.error(`Error shutting down service ${name}:`, error);
      }
    }
    
    this.logger.info('Server shutdown completed');
  }
}