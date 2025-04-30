import { ResourceController } from './controllers/resourceController';
import { ToolController } from './controllers/toolController';
import { SimpleMcpServer } from './mcp/SimpleMcpServer';
import { ExpressServer } from './server/expressServer';
import config from './services/configService';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

/**
 * Bootstrap the MCP server application
 */
function bootstrap() {
  // Create controllers
  const resourceController = new ResourceController(config);
  const toolController = new ToolController(config);

  // Create MCP server instance
  const mcpServer = new SimpleMcpServer(config);

  // Register resources and tools
  mcpServer.resource(resourceController.getInfoResourceConfig());
  mcpServer.tool(toolController.getCrawlToolConfig());
  mcpServer.tool(toolController.getMarkdownCrawlToolConfig());

  // Create and start Express server
  const server = new ExpressServer(mcpServer, config);
  const port = config.get('port');
  server.start(port);

  // Export app for testing purposes
  return server.getApp();
}

// Bootstrap the application
const app = bootstrap();

// Export app for testing purposes
export default app;