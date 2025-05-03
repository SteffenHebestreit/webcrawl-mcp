import Joi from 'joi';
import config from '../config';
import { CrawlExecutionService } from '../services/crawlExecutionService';
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
  private crawlExecutor: CrawlExecutionService;

  constructor(config: any, crawlExecutor: CrawlExecutionService) {
    this.crawlExecutor = crawlExecutor;
  }

  /**
   * Get the configuration for the basic crawl tool
   */
  getCrawlToolConfig(): ToolConfig<CrawlParams, CrawlResponse> {
    return {
      name: "crawl",
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
      execute: this.executeCrawl.bind(this),
      description: "Crawl a website and extract text content and tables.",
      parameterDescription: "URL to crawl along with optional crawling parameters like maxPages, depth, strategy, etc.",
      returnDescription: "Object containing success status, original URL, extracted text content, optional tables, and optional error message."
    };
  }

  /**
   * Get the configuration for the markdown crawl tool
   */
  getMarkdownCrawlToolConfig(): ToolConfig<CrawlWithMarkdownParams, CrawlWithMarkdownResponse> {
    return {
      name: "crawlWithMarkdown",
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
      execute: this.executeCrawlWithMarkdown.bind(this),
      description: "Crawl a website and return markdown-formatted content, potentially answering a specific query.",
      parameterDescription: "URL to crawl, optional crawling parameters, and an optional query.",
      returnDescription: "Object containing success status, original URL, markdown content, and optional error message."
    };
  }

  /**
   * Execute the basic crawl operation using CrawlExecutionService
   */
  private async executeCrawl(params: CrawlParams): Promise<CrawlResponse> {
    console.log('Executing crawl with params:', params);
    try {
      const result = await this.crawlExecutor.executeCrawl(params.url, params);

      return {
        success: result.success,
        url: result.url,
        text: result.text ?? (result.success ? 'No text content extracted.' : 'Error occurred during crawl.'),
        tables: result.media?.tables ?? [],
        error: result.error
      };
    } catch (error: any) {
      console.error('Error in ToolController executeCrawl:', error);
      return {
        success: false,
        url: params.url,
        text: `Failed to execute crawl: ${error.message}`,
        tables: [],
        error: error.message
      };
    }
  }

  /**
   * Execute the markdown crawl operation using CrawlExecutionService
   */
  private async executeCrawlWithMarkdown(params: CrawlWithMarkdownParams): Promise<CrawlWithMarkdownResponse> {
    console.log('Executing crawlWithMarkdown with params:', params);
    try {
      const result = await this.crawlExecutor.executeCrawl(params.url, params);

      return {
        success: result.success,
        url: result.url,
        markdown: result.markdown ?? (result.success ? 'No markdown content generated.' : `# Error\n\n${result.error || 'Unknown error occurred during crawl.'}`),
        error: result.error
      };
    } catch (error: any) {
      console.error('Error in ToolController executeCrawlWithMarkdown:', error);
      return {
        success: false,
        url: params.url,
        markdown: `# Error\n\nFailed to execute markdown crawl: ${error.message}`,
        error: error.message
      };
    }
  }
}