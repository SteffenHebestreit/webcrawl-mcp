import config from '../config';
import { ResourceConfig, ResourceGetResponse, ResourceListResponse } from '../types/mcp';

/**
 * Controller for handling MCP resource operations
 */
export class ResourceController {
  constructor(config: any) {
    // No longer need to store config as we're importing it directly
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
    const serverName = config.get('mcpName');
    const version = config.get('mcpVersion');
    const description = config.get('mcpDescription');
    
    return {
      contents: [
        {
          uri: "info://about",
          text: `# ${serverName} v${version}\n\n` +                `${description}\n\n` +
                "This MCP server provides web crawling capabilities for AI agents. " +
                "You can use the following tools:\n\n" +                "- `crawl`: Extract web content based on a query (requires URL and query)\n" +
                "- `crawlWithMarkdown`: Convert web content to markdown (requires URL, query is optional)\n" +
                "- `smartCrawl`: Find content relevant to a query with scoring (requires URL and query)\n" +                "- `searchInPage`: Search for specific content within a page (requires URL and query)\n" +
                "- `extractLinks`: Extract all internal links from a webpage (requires URL)\n" +
                "- `generateSitemap`: Generate a comprehensive sitemap (requires URL)\n" +
                "- `webSearch`: Search the web using various search engines (requires query only)\n" +
                "- `dateTime`: Get current date and time for a specific city (optional city parameter)\n\n" +
                "## Usage\n\n" +
                "1. Connect to the SSE endpoint at `/mcp/sse` with a POST request\n" +
                "2. Explore available tools with `mcp.capabilities`\n" +
                "3. Use tools with `mcp.tool.use` method"
        }
      ]
    };
  }
}