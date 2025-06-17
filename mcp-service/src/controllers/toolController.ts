import { Request, Response } from 'express';
import Joi from 'joi';
import config from '../config';
import { BaseTool } from '../services/tools/BaseTool';
import { DateTimeTool } from '../services/tools/DateTimeTool';
import { CrawlTool } from '../services/tools/CrawlTool';
import { ExtractLinksTool } from '../services/tools/ExtractLinksTool';
import { SmartCrawlTool } from '../services/tools/SmartCrawlTool';
import { SitemapTool } from '../services/tools/SitemapTool';
import { SearchInPageTool } from '../services/tools/SearchInPageTool';
import { WebSearchTool } from '../services/tools/WebSearchTool';
import {
  CrawlParams,
  CrawlResponse,
  CrawlWithMarkdownParams,
  CrawlWithMarkdownResponse,
  SearchInPageParams,
  SearchInPageResponse,
  SmartCrawlParams,
  SmartCrawlResponse,
  ToolConfig,
  ExtractLinksParams,
  ExtractLinksResponse,
  SitemapGeneratorParams,
  SitemapGeneratorResponse,
  WebSearchParams,
  WebSearchResponse,
  DateTimeParams,
  DateTimeResponse
} from '../types/mcp';
import { createLogger } from '../utils/logger';

/**
 * Controller for handling MCP tool operations
 */
export class ToolController {
  private dateTimeTool: DateTimeTool;
  private crawlTool: CrawlTool;
  private extractLinksTool: ExtractLinksTool;
  private smartCrawlTool: SmartCrawlTool;
  private sitemapTool: SitemapTool;
  private searchInPageTool: SearchInPageTool;
  private webSearchTool: WebSearchTool;
  private logger = createLogger('ToolController');
  private activeTools = new Map<string, { toolInstance: BaseTool<any, any>, startTime: number }>();

  constructor(config: any) {
    this.dateTimeTool = new DateTimeTool();
    this.crawlTool = new CrawlTool();
    this.extractLinksTool = new ExtractLinksTool();
    this.smartCrawlTool = new SmartCrawlTool();
    this.sitemapTool = new SitemapTool();
    this.searchInPageTool = new SearchInPageTool();
    this.webSearchTool = new WebSearchTool();
  }

  /**
   * Get the configuration for the basic crawl tool
   */
  getCrawlToolConfig(): ToolConfig<CrawlParams, CrawlResponse> {
    return {
      name: "crawl",      parameters: Joi.object({
        url: Joi.string().uri().required().messages({'string.uri': 'Please provide a valid URL'}),
        query: Joi.string().required().messages({'any.required': 'Query is required to guide the crawling process'}),
        maxPages: Joi.number().integer().min(1).max(20).optional().default(5),
        depth: Joi.number().integer().min(0).max(5).optional().default(2),
        strategy: Joi.string().valid("bfs", "dfs", "bestFirst").optional().default("bestFirst"),
        captureNetworkTraffic: Joi.boolean().optional().default(false),
        captureScreenshots: Joi.boolean().optional().default(false),
        waitTime: Joi.number().integer().min(100).max(10000).optional().default(2000),
        relevanceThreshold: Joi.number().min(0).max(10).optional().default(2),
        includeImages: Joi.boolean().optional().default(false),
        followExternalLinks: Joi.boolean().optional().default(false),
        extractMetadata: Joi.boolean().optional().default(true),
        contentFilter: Joi.string().valid("all", "text-only", "structured-only").optional().default("all"),
        language: Joi.string().optional(),
        userAgent: Joi.string().optional()
      }),      returns: Joi.object({
        success: Joi.boolean().required(),
        url: Joi.string().uri().required(),
        query: Joi.string().required(),
        text: Joi.string().required(),
        tables: Joi.array().items(Joi.any()).optional(),
        images: Joi.array().items(Joi.object({
          src: Joi.string().required(),
          alt: Joi.string().optional(),
          title: Joi.string().optional(),
          caption: Joi.string().optional()
        })).optional(),
        metadata: Joi.object({
          title: Joi.string().optional(),
          description: Joi.string().optional(),
          keywords: Joi.array().items(Joi.string()).optional(),
          language: Joi.string().optional(),
          author: Joi.string().optional(),
          publishDate: Joi.string().optional()
        }).optional(),
        links: Joi.array().items(Joi.object({
          url: Joi.string().required(),
          text: Joi.string().required(),
          relevance: Joi.number().required()
        })).optional(),
        contentSummary: Joi.string().optional(),
        relevanceScore: Joi.number().optional(),
        pagesVisited: Joi.number().optional(),
        totalContentLength: Joi.number().optional(),
        processingTime: Joi.number().optional(),
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
   * Get the configuration for the search in page tool
   */
  getSearchInPageToolConfig(): ToolConfig<SearchInPageParams, SearchInPageResponse> {
    return {
      name: "searchInPage",
      parameters: Joi.object({
        url: Joi.string().uri().required().messages({'string.uri': 'Please provide a valid URL'}),
        query: Joi.string().required(),
        maxResults: Joi.number().integer().min(1).max(50).optional()
      }),
      returns: Joi.object({
        success: Joi.boolean().required(),
        url: Joi.string().uri().required(),
        query: Joi.string().required(),
        matches: Joi.array().items(Joi.object({
          snippet: Joi.string().required(),
          position: Joi.number().required(),
          relevance: Joi.number().required()
        })).required(),
        summary: Joi.string().required(),
        totalMatches: Joi.number().required(),
        error: Joi.string().optional()
      }),
      execute: this.executeSearchInPage.bind(this),
      description: "Search for specific content within a web page.",
      parameterDescription: "Required: url, query | Optional: maxResults (default: 10).",
      returnDescription: "Search results with snippets and relevance scores."
    };
  }

  /**
   * Get the configuration for the smart crawl tool
   */
  getSmartCrawlToolConfig(): ToolConfig<SmartCrawlParams, SmartCrawlResponse> {
    return {
      name: "smartCrawl",
      parameters: Joi.object({
        url: Joi.string().uri().required().messages({'string.uri': 'Please provide a valid URL'}),
        query: Joi.string().required(),
        maxPages: Joi.number().integer().min(1).optional(),
        depth: Joi.number().integer().min(0).optional(),
        relevanceThreshold: Joi.number().min(0).max(10).optional()
      }),
      returns: Joi.object({
        success: Joi.boolean().required(),
        url: Joi.string().uri().required(),
        query: Joi.string().required(),
        relevantPages: Joi.array().items(Joi.object({
          url: Joi.string().required(),
          title: Joi.string().required(),
          summary: Joi.string().required(),
          relevanceScore: Joi.number().required(),
          keyFindings: Joi.array().items(Joi.string()).required()
        })).required(),
        overallSummary: Joi.string().required(),
        error: Joi.string().optional()
      }),
      execute: this.executeSmartCrawl.bind(this),
      description: "Intelligently crawl a website to find content relevant to a query.",
      parameterDescription: "Required: url, query | Optional: maxPages (default: 5), depth (default: 2), relevanceThreshold (default: 2).",
      returnDescription: "Relevant pages with scores, key findings, and a summary."
    };
  }

  /**
   * Get the configuration for the extract links tool
   */
  getExtractLinksToolConfig(): ToolConfig<ExtractLinksParams, ExtractLinksResponse> {
    return {
      name: "extractLinks",      parameters: Joi.object({
        url: Joi.string().uri().required().messages({'string.uri': 'Please provide a valid URL'}),
        includeFragments: Joi.boolean().optional().default(true),
        includeQueryParams: Joi.boolean().optional().default(true),
        categorizeLinks: Joi.boolean().optional().default(true),
        includeExternalLinks: Joi.boolean().optional().default(true),
        maxLinks: Joi.number().integer().min(1).max(500).optional().default(100),
        sortBy: Joi.string().valid("url", "text", "relevance").optional().default("relevance")
      }),      returns: Joi.object({
        success: Joi.boolean().required(),
        url: Joi.string().uri().required(),
        links: Joi.array().items(Joi.object({
          url: Joi.string().required(),
          text: Joi.string().required(),
          title: Joi.string().optional(),
          type: Joi.string().valid("navigation", "content", "media", "form", "other").required(),
          depth: Joi.number().required(),
          section: Joi.string().optional(),
          isExternal: Joi.boolean().required()
        })).required(),
        linksByType: Joi.object({
          navigation: Joi.number().required(),
          content: Joi.number().required(),
          media: Joi.number().required(),
          form: Joi.number().required(),
          other: Joi.number().required()
        }).optional(),
        totalLinks: Joi.number().required(),
        internalLinks: Joi.number().required(),
        externalLinks: Joi.number().required(),
        pageTitle: Joi.string().optional(),
        baseUrl: Joi.string().required(),
        error: Joi.string().optional()
      }),      execute: this.executeExtractLinks.bind(this),
      description: "Extract all links (both internal and external) from a webpage.",
      parameterDescription: "Required: url | Optional: includeFragments (default: true), includeExternalLinks (default: true), maxLinks (default: 100), sortBy (default: 'relevance').",
      returnDescription: "Links categorized by type with metadata and statistics. Links are marked as internal or external."
    };
  }

  /**
   * Get the configuration for the sitemap generator tool
   */
  getSitemapGeneratorToolConfig(): ToolConfig<SitemapGeneratorParams, SitemapGeneratorResponse> {
    return {
      name: "generateSitemap",
      parameters: Joi.object({
        url: Joi.string().uri().required().messages({'string.uri': 'Please provide a valid URL'}),
        depth: Joi.number().integer().min(0).max(5).optional().default(2),
        maxPages: Joi.number().integer().min(1).max(200).optional().default(50),
        includeExternalLinks: Joi.boolean().optional().default(false),
        respectRobotsTxt: Joi.boolean().optional().default(true),
        followRedirects: Joi.boolean().optional().default(true),
        excludePatterns: Joi.array().items(Joi.string()).optional(),
        includeMetadata: Joi.boolean().optional().default(true)
      }),
      returns: Joi.object({
        success: Joi.boolean().required(),
        url: Joi.string().uri().required(),
        sitemap: Joi.array().items(Joi.object({
          url: Joi.string().required(),
          title: Joi.string().optional(),
          description: Joi.string().optional(),
          depth: Joi.number().required(),
          parentUrl: Joi.string().optional(),
          status: Joi.string().valid("crawled", "error", "excluded", "external").required(),
          lastModified: Joi.string().optional(),
          contentType: Joi.string().optional(),
          wordCount: Joi.number().optional(),
          headings: Joi.object({
            h1: Joi.array().items(Joi.string()).optional(),
            h2: Joi.array().items(Joi.string()).optional(),
            h3: Joi.array().items(Joi.string()).optional()
          }).optional(),
          error: Joi.string().optional()
        })).required(),
        statistics: Joi.object({
          totalPages: Joi.number().required(),
          successfulPages: Joi.number().required(),
          errorPages: Joi.number().required(),
          externalLinks: Joi.number().required(),
          maxDepthReached: Joi.number().required(),
          crawlDuration: Joi.number().required()
        }).required(),
        hierarchy: Joi.object().pattern(Joi.string(), Joi.array().items(Joi.string())).required(),
        baseUrl: Joi.string().required(),
        crawlTimestamp: Joi.string().required(),
        error: Joi.string().optional()
      }),
      execute: this.executeGenerateSitemap.bind(this),
      description: "Generate a comprehensive sitemap by crawling a website.",
      parameterDescription: "Required: url | Optional: depth (default: 2), maxPages (default: 50), includeExternalLinks (default: false).",
      returnDescription: "Sitemap with page hierarchy, metadata, and statistics."
    };
  }

  /**
   * Get the configuration for the web search tool
   */
  getWebSearchToolConfig(): ToolConfig<WebSearchParams, WebSearchResponse> {
    return {
      name: "webSearch",
      parameters: Joi.object({
        query: Joi.string().required().messages({'any.required': 'Search query is required'}),
        engine: Joi.string().valid("google", "duckduckgo", "searxng").optional().default("duckduckgo"),
        numResults: Joi.number().integer().min(1).max(30).optional().default(10),
        safeSearch: Joi.boolean().optional().default(true),
        timeRange: Joi.string().valid("day", "week", "month", "year").optional()
      }),
      returns: Joi.object({
        success: Joi.boolean().required(),
        query: Joi.string().required(),
        engine: Joi.string().valid("google", "duckduckgo", "searxng").required(),
        results: Joi.array().items(Joi.object({
          title: Joi.string().required(),
          url: Joi.string().required(),
          snippet: Joi.string().required(),
          position: Joi.number().required()
        })).required(),
        totalResults: Joi.number().required(),
        searchTimeMs: Joi.number().required(),
        error: Joi.string().optional()
      }),
      execute: this.executeWebSearch.bind(this),
      description: "Search the web using various search engines.",
      parameterDescription: "Required: query | Optional: engine (default: 'duckduckgo'), numResults (default: 10), safeSearch (default: true), timeRange.",
      returnDescription: "Search results containing titles, URLs, and snippets from the selected search engine."
    };
  }

  /**
   * Get the configuration for the date/time utility tool
   */
  getDateTimeToolConfig(): ToolConfig<DateTimeParams, DateTimeResponse> {
    return {
      name: "dateTime",
      parameters: Joi.object({
        city: Joi.string().optional().default("Berlin").description("City name to determine timezone (default: Berlin)"),
        format: Joi.string().valid("iso", "human", "both").optional().default("both").description("Output format preference"),
        includeTimezone: Joi.boolean().optional().default(true).description("Include timezone information in response")
      }),
      returns: Joi.object({
        success: Joi.boolean().required(),
        city: Joi.string().required(),
        timezone: Joi.string().required(),
        currentDateTime: Joi.object({
          iso: Joi.string().required(),
          human: Joi.string().required(),
          utc: Joi.string().required()
        }).required(),
        additionalInfo: Joi.object({
          dayOfWeek: Joi.string().required(),
          dayOfYear: Joi.number().required(),
          weekOfYear: Joi.number().required(),
          quarter: Joi.number().required(),
          isDaylightSaving: Joi.boolean().optional(),
          timezoneOffset: Joi.string().required()
        }).required(),
        error: Joi.string().optional()
      }),
      execute: this.executeDateTime.bind(this),
      description: "Get current date and time for a specific city with timezone information.",
      parameterDescription: "Optional: city (default: 'Berlin'), format (default: 'both'), includeTimezone (default: true).",
      returnDescription: "Current date and time in multiple formats with timezone and additional calendar information."
    };
  }  /**
   * Execute the basic crawl operation using CrawlTool
   */
  private async executeCrawl(params: CrawlParams): Promise<CrawlResponse> {
    const toolId = `crawl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return await this.executeToolWithTracking(toolId, this.crawlTool, params);
  }  /**
   * Execute the markdown crawl operation using CrawlTool
   */
  private async executeCrawlWithMarkdown(params: CrawlWithMarkdownParams): Promise<CrawlWithMarkdownResponse> {
    this.logger.info('Executing crawlWithMarkdown with params:', params);
    try {
      // First get the raw content using CrawlTool directly
      const crawlParams: CrawlParams = {
        url: params.url,
        query: params.query || `Extract content from ${params.url}`,
        maxPages: params.maxPages || 1,
        depth: params.depth || 0,
        strategy: params.strategy || 'bestFirst'
      };
      
      // Generate a tool ID for tracking
      const toolId = `crawlwithmarkdown-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Execute the crawl with tracking
      const result = await this.executeToolWithTracking(toolId, this.crawlTool, crawlParams);
      
      if (!result.success || !result.text) {
        return {
          success: false,
          url: params.url,
          query: params.query || `Content from ${params.url}`,
          markdown: `# Error\n\nFailed to extract content: ${result.error || 'Unknown error'}`,
          contentSummary: `Failed to extract content${params.query ? ` for query: "${params.query}"` : ''}`,
          wordCount: 0,
          estimatedReadingTime: 0,
          error: result.error || 'Failed to extract content'
        };
      }
      
      // Convert the clean text to markdown format
      let markdown = '';
      
      // Add title if available
      if (result.metadata?.title) {
        markdown += `# ${result.metadata.title}\n\n`;
      } else {
        markdown += `# Content from ${params.url}\n\n`;
      }
      
      // Process the text into markdown sections
      const sections = result.text.split(/\n{2,}/);
      sections.forEach(section => {
        if (section.trim()) {
          // Check if this looks like a heading
          if (section.length < 60 && section.toUpperCase() === section) {
            markdown += `## ${section.trim()}\n\n`;
          } else {
            markdown += `${section.trim()}\n\n`;
          }
        }
      });
      
      return {
        success: true,
        url: result.url,
        query: params.query || `Content from ${params.url}`,
        markdown: markdown,
        contentSummary: result.success ? `Markdown content extracted${params.query ? ` for query: "${params.query}"` : ''}` : undefined,
        wordCount: markdown.split(/\s+/).length || 0,
        estimatedReadingTime: Math.ceil((markdown.split(/\s+/).length || 0) / 200),
        error: result.error
      };
    } catch (error: any) {
      this.logger.error('Error in ToolController executeCrawlWithMarkdown:', error);
      return {
        success: false,
        url: params.url,
        query: params.query || `Content from ${params.url}`,
        markdown: `# Error\n\nFailed to execute markdown crawl: ${error.message}`,
        contentSummary: `Failed to extract markdown content${params.query ? ` for query: "${params.query}"` : ''}`,
        wordCount: 0,
        estimatedReadingTime: 0,
        error: error.message
      };
    }
  }
  /**
   * Execute date/time tool using DateTimeTool service
   */  
  private async executeDateTime(params: DateTimeParams): Promise<DateTimeResponse> {
    const toolId = `datetime-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return await this.executeToolWithTracking(toolId, this.dateTimeTool, params);
  }  /**
   * Execute web search using the selected search engine
   */
  private async executeWebSearch(params: WebSearchParams): Promise<WebSearchResponse> {
    const toolId = `websearch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return await this.executeToolWithTracking(toolId, this.webSearchTool, params);
  }/**
   * Execute search within a specific page
   */
  private async executeSearchInPage(params: SearchInPageParams): Promise<SearchInPageResponse> {
    const toolId = `searchinpage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return await this.executeToolWithTracking(toolId, this.searchInPageTool, params);
  }  /**
   * Execute smart crawl with relevance scoring
   */
  private async executeSmartCrawl(params: SmartCrawlParams): Promise<SmartCrawlResponse> {
    const toolId = `smartcrawl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return await this.executeToolWithTracking(toolId, this.smartCrawlTool, params);
  }  /**
   * Execute link extraction from a specific page
   */
  private async executeExtractLinks(params: ExtractLinksParams): Promise<ExtractLinksResponse> {
    const toolId = `extractlinks-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return await this.executeToolWithTracking(toolId, this.extractLinksTool, params);
  }  /**
   * Execute sitemap generation
   */
  private async executeGenerateSitemap(params: SitemapGeneratorParams): Promise<SitemapGeneratorResponse> {
    const toolId = `sitemap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return await this.executeToolWithTracking(toolId, this.sitemapTool, params);
  }
  /**
   * Abort a tool execution by toolId
   * @param toolId The ID of the tool execution to abort
   * @returns A boolean indicating whether the abort was successful
   */
  public abortToolExecution(toolId: string): boolean {
    try {
      this.logger.info(`Attempting to abort tool execution: ${toolId}`);
      
      const activeToolData = this.activeTools.get(toolId);
      if (!activeToolData) {
        this.logger.warn(`No active tool found with ID: ${toolId}`);
        return false;
      }
      
      const { toolInstance, startTime } = activeToolData;
      const executionTime = Date.now() - startTime;
      
      this.logger.info(`Aborting tool execution ${toolId} after ${executionTime}ms`);
      const abortSuccess = toolInstance.abort();
      
      if (abortSuccess) {
        this.activeTools.delete(toolId);
        this.logger.info(`Successfully aborted tool execution: ${toolId}`);
      } else {
        this.logger.warn(`Failed to abort tool execution: ${toolId}`);
      }
      
      return abortSuccess;
    } catch (error) {
      this.logger.error(`Error aborting tool execution ${toolId}:`, error);
      return false;
    }
  }
  
  /**
   * Execute tool with tracking
   * @param toolId Unique identifier for this tool execution
   * @param toolInstance The tool instance to execute
   * @param params The parameters for the tool
   * @returns Result from the tool execution
   */
  private async executeToolWithTracking<P, R>(
    toolId: string, 
    toolInstance: BaseTool<P, R>, 
    params: P
  ): Promise<R> {
    try {
      // Register the active tool execution
      this.activeTools.set(toolId, {
        toolInstance,
        startTime: Date.now()
      });
      
      // Execute the tool
      const result = await toolInstance.execute(params);
      
      // Clean up the tracking
      this.activeTools.delete(toolId);
      
      return result;
    } catch (error) {
      // Clean up tracking on error
      this.activeTools.delete(toolId);
      throw error;
    }
  }
}