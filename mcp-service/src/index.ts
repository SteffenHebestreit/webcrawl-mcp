import { Server } from './server/server';
import config from './config';

/**
 * Bootstrap the application
 */
function bootstrap() {
  // Create and start the unified server
  const server = new Server();
  const port = config.get('port');
  server.start(port);

  // Export app for testing purposes
  return server.getApp();
}

// Bootstrap the application
const app = bootstrap();

// Export app for testing purposes
export default app;