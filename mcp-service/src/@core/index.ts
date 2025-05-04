import path from 'path';
import { Server } from './server/Server.js';
import configManager from './config/configManager.js';
import { createLogger } from './utils/logger.js';

// Create a logger for the main application
const logger = createLogger('App');

/**
 * Bootstrap the application
 */
async function bootstrap() {
  try {
    // Initialize configuration with both environment variables and config files
    // Look for tools.json in the mapped mcp-config directory
    const configFilePath = path.join('/app/mcp-config', 'tools.json');
    await configManager.init([configFilePath]);
    logger.info('Configuration initialized from external mcp-config directory');

    // Create and initialize the server asynchronously
    const server = new Server();
    await server.init(); // Wait for server to initialize properly
    
    // Start the server after initialization
    const port = configManager.get('port', 3000);
    server.start(port);
    logger.info(`Server started on port ${port}`);

    // Handle graceful shutdown
    setupShutdownHandlers(server);

    // Export app for testing purposes
    return server.getApp();
  } catch (error) {
    logger.error('Error during bootstrap:', error);
    process.exit(1);
  }
}

/**
 * Setup handlers for graceful shutdown
 */
function setupShutdownHandlers(server: Server) {
  // Handle SIGINT and SIGTERM signals
  const signals = ['SIGINT', 'SIGTERM'];
  
  signals.forEach(signal => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down...`);
      try {
        await server.shutdown();
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });
  });

  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason);
  });
}

// Bootstrap the application
const app = bootstrap();

// Export app for testing purposes
export default app;