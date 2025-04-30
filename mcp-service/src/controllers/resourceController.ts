import { ConfigService } from '../services/configService';
import { ResourceConfig, ResourceGetResponse, ResourceListResponse } from '../types/mcp';

/**
 * Controller for handling MCP resource operations
 */
export class ResourceController {
  private config: ConfigService;

  constructor(config: ConfigService) {
    this.config = config;
  }
  
  /**
   * Get the info resource configuration
   * This resource provides information about the MCP server and available tools
   */
  getInfoResourceConfig(): ResourceConfig {
    return {
      name: "info",
      uri: "info://about",
      handlers: {
        list: this.listInfoResources.bind(this),
        get: this.getInfoResource.bind(this)
      }
    };
  }

  /**
   * List available info resources
   */
  private async listInfoResources(): Promise<ResourceListResponse> {
    return {
      uris: ["info://about"]
    };
  }

  /**
   * Get info resource content
   */
  private async getInfoResource(): Promise<ResourceGetResponse> {
    const serverName = this.config.get('mcpName');
    const version = this.config.get('mcpVersion');
    const description = this.config.get('mcpDescription');
    
    return {
      contents: [
        {
          uri: "info://about",
          text: `# ${serverName} v${version}\n\n` +
                `${description}\n\n` +
                "This MCP server provides web crawling capabilities using Crawl4AI. " +
                "You can use the following tools:\n\n" +
                "- `crawl`: Crawl a website and get structured data back\n" +
                "- `crawlWithMarkdown`: Crawl a website and get markdown-formatted content\n\n" +
                "## Usage\n\n" +
                "1. Connect to the SSE endpoint at `/mcp/sse` with a POST request\n" +
                "2. Explore available tools with `mcp.capabilities`\n" +
                "3. Use tools with `mcp.tool.use` method"
        }
      ]
    };
  }
}