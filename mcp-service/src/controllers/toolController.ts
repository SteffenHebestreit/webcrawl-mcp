import { z } from 'zod';
import { ConfigService } from '../services/configService';
import { CrawlService } from '../services/crawlService';
import { 
  CrawlParams, 
  CrawlResponse, 
  CrawlWithMarkdownParams, 
  CrawlWithMarkdownResponse,
  ToolConfig
} from '../types/mcp';

/**
 * Controller for handling MCP tool operations
 */
export class ToolController {
  private crawlService: CrawlService;
  private config: ConfigService;

  constructor(config: ConfigService) {
    this.config = config;
    this.crawlService = new CrawlService(config);
  }

  /**
   * Get the configuration for the basic crawl tool
   */
  getCrawlToolConfig(): ToolConfig<CrawlParams, CrawlResponse> {
    return {
      name: "crawl",
      parameters: z.object({
        url: z.string().url("Please provide a valid URL"),
        maxPages: z.number().optional(),
        depth: z.number().optional(),
        strategy: z.enum(["bfs", "dfs", "bestFirst"]).optional(),
        captureNetworkTraffic: z.boolean().optional(),
        captureScreenshots: z.boolean().optional(),
        waitTime: z.number().optional()
      }),
      returns: z.object({
        success: z.boolean(),
        url: z.string(),
        text: z.string(),
        tables: z.array(z.any()).optional()
      }),
      execute: this.executeCrawl.bind(this),
      description: "Crawl a website and extract structured information",
      parameterDescription: "URL to crawl along with optional crawling parameters",
      returnDescription: "Extracted text content and structured data"
    };
  }

  /**
   * Get the configuration for the markdown crawl tool
   */
  getMarkdownCrawlToolConfig(): ToolConfig<CrawlWithMarkdownParams, CrawlWithMarkdownResponse> {
    return {
      name: "crawlWithMarkdown",
      parameters: z.object({
        url: z.string().url("Please provide a valid URL"),
        maxPages: z.number().optional(),
        depth: z.number().optional(),
        strategy: z.enum(["bfs", "dfs", "bestFirst"]).optional(),
        query: z.string().optional()
      }),
      returns: z.object({
        success: z.boolean(),
        url: z.string(),
        markdown: z.string()
      }),
      execute: this.executeCrawlWithMarkdown.bind(this),
      description: "Crawl a website and return markdown-formatted content",
      parameterDescription: "URL to crawl and optional parameters including a specific question to answer",
      returnDescription: "Markdown-formatted content from the crawled website"
    };
  }

  /**
   * Execute the basic crawl operation
   */
  private async executeCrawl(params: CrawlParams): Promise<CrawlResponse> {
    try {
      const { url, maxPages, depth, strategy, captureNetworkTraffic, captureScreenshots, waitTime } = params;
      
      // Create options object for crawl service
      const options = {
        maxPages,
        depth,
        strategy,
        captureNetworkTraffic,
        captureScreenshots,
        waitTime
      };
      
      const result = await this.crawlService.crawlWebsite(url, options);
      
      return {
        success: result.success,
        url: result.url,
        text: result.text,
        tables: result.media?.tables
      };
    } catch (error: any) {
      console.error('Error during crawling:', error);
      return {
        success: false,
        url: params.url,
        text: `Error: ${error.message || 'Unknown error during crawling'}`,
        tables: []
      };
    }
  }

  /**
   * Execute the markdown crawl operation
   */
  private async executeCrawlWithMarkdown(params: CrawlWithMarkdownParams): Promise<CrawlWithMarkdownResponse> {
    try {
      const { url, maxPages, depth, strategy, query } = params;
      
      // Create options object for crawl service
      const options = {
        maxPages,
        depth,
        strategy,
        query,
        markdownFormat: true
      };
      
      const result = await this.crawlService.crawlWebsite(url, options);
      
      return {
        success: result.success,
        url: result.url,
        markdown: result.markdown
      };
    } catch (error: any) {
      console.error('Error during markdown crawling:', error);
      return {
        success: false,
        url: params.url,
        markdown: `# Error\n\nError occurred while crawling ${params.url}: ${error.message || 'Unknown error'}`
      };
    }
  }
}