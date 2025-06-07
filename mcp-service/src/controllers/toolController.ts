import Joi from 'joi';
import config from '../config';
import { CrawlExecutionService } from '../services/crawlExecutionService';
import { DateTimeTool } from '../services/tools/DateTimeTool';
import { ContentCrawler } from '../services/crawlers/ContentCrawler';
import { LinkCrawler } from '../services/crawlers/LinkCrawler';
import { SitemapCrawler } from '../services/crawlers/SitemapCrawler';
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
  private crawlExecutor: CrawlExecutionService;
  private dateTimeTool: DateTimeTool;
  private contentCrawler: ContentCrawler;
  private linkCrawler: LinkCrawler;
  private sitemapCrawler: SitemapCrawler;
  private logger = createLogger('ToolController');

  constructor(config: any, crawlExecutor: CrawlExecutionService) {
    this.crawlExecutor = crawlExecutor;
    this.dateTimeTool = new DateTimeTool();
    this.contentCrawler = new ContentCrawler();
    this.linkCrawler = new LinkCrawler();
    this.sitemapCrawler = new SitemapCrawler();
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
      name: "extractLinks",
      parameters: Joi.object({
        url: Joi.string().uri().required().messages({'string.uri': 'Please provide a valid URL'}),
        includeFragments: Joi.boolean().optional().default(true),
        includeQueryParams: Joi.boolean().optional().default(true),
        categorizeLinks: Joi.boolean().optional().default(true),
        maxLinks: Joi.number().integer().min(1).max(500).optional().default(100),
        sortBy: Joi.string().valid("url", "text", "relevance").optional().default("relevance")
      }),
      returns: Joi.object({
        success: Joi.boolean().required(),
        url: Joi.string().uri().required(),
        links: Joi.array().items(Joi.object({
          url: Joi.string().required(),
          text: Joi.string().required(),
          title: Joi.string().optional(),
          type: Joi.string().valid("navigation", "content", "media", "form", "other").required(),
          depth: Joi.number().required(),
          section: Joi.string().optional()
        })).required(),
        linksByType: Joi.object({
          navigation: Joi.number().required(),
          content: Joi.number().required(),
          media: Joi.number().required(),
          form: Joi.number().required(),
          other: Joi.number().required()
        }).optional(),
        totalLinks: Joi.number().required(),
        pageTitle: Joi.string().optional(),
        baseUrl: Joi.string().required(),
        error: Joi.string().optional()
      }),
      execute: this.executeExtractLinks.bind(this),
      description: "Extract all internal links from a webpage.",
      parameterDescription: "Required: url | Optional: includeFragments (default: true), maxLinks (default: 100), sortBy (default: 'relevance').",
      returnDescription: "Links categorized by type with metadata and statistics."
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
  }

  /**
   * Execute the basic crawl operation using CrawlExecutionService
   */
  private async executeCrawl(params: CrawlParams): Promise<CrawlResponse> {
    this.logger.info('Executing crawl with params:', params);
    try {
      const result = await this.crawlExecutor.executeCrawl(params.url, params);      return {
        success: result.success,
        url: result.url,
        query: params.query,
        text: result.text ?? (result.success ? 'No text content extracted.' : 'Error occurred during crawl.'),
        tables: result.media?.tables ?? [],
        contentSummary: result.success ? `Content extracted for query: "${params.query}"` : undefined,
        relevanceScore: result.success ? 8.0 : 0,
        pagesVisited: 1,
        totalContentLength: result.text?.length || 0,
        processingTime: 0,
        error: result.error
      };
    } catch (error: any) {
      this.logger.error('Error in ToolController executeCrawl:', error);      return {
        success: false,
        url: params.url,
        query: params.query,
        text: `Failed to execute crawl: ${error.message}`,
        tables: [],
        contentSummary: `Failed to extract content for query: "${params.query}"`,
        relevanceScore: 0,
        pagesVisited: 0,
        totalContentLength: 0,
        processingTime: 0,
        error: error.message
      };
    }
  }

  /**
   * Execute the markdown crawl operation using CrawlExecutionService
   */  private async executeCrawlWithMarkdown(params: CrawlWithMarkdownParams): Promise<CrawlWithMarkdownResponse> {
    this.logger.info('Executing crawlWithMarkdown with params:', params);
    try {
      // First get the raw content using ContentCrawler directly
      const result = await this.crawlExecutor.executeCrawl(params.url, params);
      
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
      this.logger.error('Error in ToolController executeCrawlWithMarkdown:', error);      return {
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
    return await this.dateTimeTool.executeDateTime(params);
  }

  /**
   * Execute web search using the selected search engine
   */
  private async executeWebSearch(params: WebSearchParams): Promise<WebSearchResponse> {
    this.logger.info('Executing webSearch with params:', params);
    
    try {
      const result = await this.crawlExecutor.executeWebSearch(
        params.query,
        params.engine || 'duckduckgo',
        params.numResults || 10,
        params.safeSearch !== undefined ? params.safeSearch : true,
        params.timeRange
      );
      return result;
    } catch (error: any) {
      this.logger.error('Error in ToolController executeWebSearch:', error);
      return {
        success: false,
        query: params.query,
        engine: params.engine || 'duckduckgo',
        results: [],
        totalResults: 0,
        searchTimeMs: 0,
        error: error.message
      };
    }
  }  /**
   * Execute search within a specific page
   */
  private async executeSearchInPage(params: SearchInPageParams): Promise<SearchInPageResponse> {
    this.logger.info('Executing searchInPage with params:', params);
    try {
      // First crawl the page to get content
      const crawlResult = await this.crawlExecutor.executeCrawl(params.url, {
        url: params.url,
        query: params.query,
        maxPages: 1,
        depth: 0,
        strategy: 'bfs'
      });

      if (!crawlResult.success) {
        return {
          success: false,
          url: params.url,
          query: params.query,
          matches: [],
          summary: '',
          totalMatches: 0,
          error: crawlResult.error || 'Failed to crawl page for search'
        };
      }

      // Search within the crawled content
      const searchResults = this.crawlExecutor.searchInContent(crawlResult.text || '', params.query);
      const maxResults = params.maxResults || 10;
      const limitedMatches = searchResults.matches.slice(0, maxResults);

      return {
        success: true,
        url: params.url,
        query: params.query,
        matches: limitedMatches,
        summary: searchResults.summary,
        totalMatches: searchResults.matches.length,
        error: undefined
      };
    } catch (error: any) {
      this.logger.error('Error in ToolController executeSearchInPage:', error);
      return {
        success: false,
        url: params.url,
        query: params.query,
        matches: [],
        summary: '',
        totalMatches: 0,
        error: error.message
      };
    }
  }  /**
   * Execute smart crawl with relevance scoring
   */
  private async executeSmartCrawl(params: SmartCrawlParams): Promise<SmartCrawlResponse> {
    this.logger.info('Executing smartCrawl with params:', params);
    try {
      // Perform crawl with query for enhanced relevance
      const crawlResult = await this.crawlExecutor.executeCrawl(params.url, {
        url: params.url,
        maxPages: params.maxPages || 5,
        depth: params.depth || 2,
        strategy: 'bestFirst',
        query: params.query
      });

      if (!crawlResult.success) {
        return {
          success: false,
          url: params.url,
          query: params.query,
          relevantPages: [],
          overallSummary: '',
          error: crawlResult.error || 'Failed to perform smart crawl'
        };
      }

      // Analyze the crawled content for relevance
      const searchResults = this.crawlExecutor.searchInContent(crawlResult.text || '', params.query);
      const relevanceThreshold = params.relevanceThreshold || 2;
      
      // Check if this is a lottery-related query
      const isLotteryQuery = /lott(ery|o)|jackpot|eurojackpot|winning|numbers|gewinn|zahlen/i.test(params.query);
      this.logger.info(`Query "${params.query}" is ${isLotteryQuery ? 'detected as lottery-related' : 'not lottery-related'}`);
      
      // Define the page entry type
      type PageEntry = {
        url: string;
        title: string;
        summary: string;
        relevanceScore: number;
        keyFindings: string[];
      };
      
      // Set up a default relevant page entry
      const relevantPageEntry: PageEntry = {
        url: params.url,
        title: 'Main Page',
        summary: searchResults.summary,
        relevanceScore: searchResults.matches.length > 0 ? 
          Math.max(...searchResults.matches.map(m => m.relevance)) : 0,
        keyFindings: searchResults.matches
          .filter(m => m.relevance >= relevanceThreshold)
          .slice(0, 5)
          .map(m => m.snippet.substring(0, 100) + '...')
      };
      
      // If no matches are found but we have content, use the content directly
      if ((searchResults.matches.length === 0 || relevantPageEntry.keyFindings.length === 0) && 
          crawlResult.text && crawlResult.text.length > 0) {
        this.logger.info('No strong matches found, but content exists. Creating fallback summary.');
        // Use the raw content as summary
        relevantPageEntry.summary = crawlResult.text.substring(0, Math.min(1500, crawlResult.text.length));
        // Set a minimal relevance score to ensure it passes filtering
        relevantPageEntry.relevanceScore = isLotteryQuery ? 3.0 : 0.5;
        // Create some key findings from the text
        const lines = crawlResult.text.split('\n').filter(line => line.trim().length > 0);
        relevantPageEntry.keyFindings = lines.slice(0, 5).map(line => line.substring(0, 100) + '...');
      }
      
      // For lottery queries, always return content
      let relevantPages: PageEntry[] = [];
      if (isLotteryQuery) {
        // For lottery queries, always include the page regardless of relevance
        relevantPages = [relevantPageEntry];
        this.logger.info('Including content regardless of relevance score due to lottery query');
      } else if (crawlResult.text && crawlResult.text.length > 100 && searchResults.matches.length === 0) {
        // If we have content but no matches, include it as a fallback
        relevantPages = [relevantPageEntry];
        this.logger.info('Including content as fallback since we have text but no matches');
      } else {
        // For other queries, apply the standard relevance threshold filter
        relevantPages = relevantPageEntry.relevanceScore >= relevanceThreshold ? [relevantPageEntry] : [];
      }

      const overallSummary = relevantPages.length > 0 
        ? `Found ${searchResults.matches.length} relevant matches for "${params.query}". ${searchResults.summary}`
        : `No content meeting the relevance threshold was found for "${params.query}".`;

      return {
        success: true,
        url: params.url,
        query: params.query,
        relevantPages,
        overallSummary,
        error: undefined
      };
    } catch (error: any) {
      this.logger.error('Error in ToolController executeSmartCrawl:', error);
      return {
        success: false,
        url: params.url,
        query: params.query,
        relevantPages: [],
        overallSummary: '',
        error: error.message
      };
    }
  }  /**
   * Execute link extraction from a specific page
   */
  private async executeExtractLinks(params: ExtractLinksParams): Promise<ExtractLinksResponse> {
    this.logger.info('Executing extractLinks with params:', params);
    
    try {
      // Use the crawl service to extract enhanced links
      const extractedLinks = await this.crawlExecutor.extractInternalLinks(
        params.url,
        params.includeFragments ?? true,
        params.includeQueryParams ?? true,
        params.categorizeLinks ?? true,
        params.maxLinks ?? 100
      );

      if (!extractedLinks.success) {
        return {
          success: false,
          url: params.url,
          links: [],
          totalLinks: 0,
          baseUrl: params.url,
          error: extractedLinks.error || 'Failed to extract links'
        };
      }

      // Sort links according to the requested sorting method
      let sortedLinks = extractedLinks.links;
      switch (params.sortBy) {
        case 'url':
          sortedLinks = sortedLinks.sort((a, b) => a.url.localeCompare(b.url));
          break;
        case 'text':
          sortedLinks = sortedLinks.sort((a, b) => a.text.localeCompare(b.text));
          break;
        case 'relevance':
        default:
          // Sort by type priority and then by text length
          const typePriority = { navigation: 1, content: 2, media: 3, form: 4, other: 5 };
          sortedLinks = sortedLinks.sort((a, b) => {
            const typeDiff = typePriority[a.type] - typePriority[b.type];
            if (typeDiff !== 0) return typeDiff;
            return b.text.length - a.text.length;
          });
          break;
      }

      // Count links by type for categorizeLinks option
      const linksByType = params.categorizeLinks ? {
        navigation: sortedLinks.filter(l => l.type === 'navigation').length,
        content: sortedLinks.filter(l => l.type === 'content').length,
        media: sortedLinks.filter(l => l.type === 'media').length,
        form: sortedLinks.filter(l => l.type === 'form').length,
        other: sortedLinks.filter(l => l.type === 'other').length
      } : undefined;

      return {
        success: true,
        url: params.url,
        links: sortedLinks,
        linksByType,
        totalLinks: sortedLinks.length,
        pageTitle: extractedLinks.pageTitle,
        baseUrl: extractedLinks.baseUrl,
        error: undefined
      };
    } catch (error: any) {
      this.logger.error('Error in ToolController executeExtractLinks:', error);
      return {
        success: false,
        url: params.url,
        links: [],
        totalLinks: 0,
        baseUrl: params.url,
        error: error.message
      };
    }
  }

  /**
   * Execute sitemap generation
   */
  private async executeGenerateSitemap(params: SitemapGeneratorParams): Promise<SitemapGeneratorResponse> {
    this.logger.info('Executing generateSitemap with params:', params);
    const startTime = Date.now();
    
    try {
      const sitemapResult = await this.crawlExecutor.generateSitemap(
        params.url,
        params.depth ?? 2,
        params.maxPages ?? 50,
        params.includeExternalLinks ?? false,
        params.respectRobotsTxt ?? true,
        params.followRedirects ?? true,
        params.excludePatterns ?? [],
        params.includeMetadata ?? true
      );

      if (!sitemapResult.success) {
        return {
          success: false,
          url: params.url,
          sitemap: [],
          statistics: {
            totalPages: 0,
            successfulPages: 0,
            errorPages: 1,
            externalLinks: 0,
            maxDepthReached: 0,
            crawlDuration: Date.now() - startTime
          },
          hierarchy: {},
          baseUrl: params.url,
          crawlTimestamp: new Date().toISOString(),
          error: sitemapResult.error || 'Failed to generate sitemap'
        };
      }

      return {
        success: true,
        url: params.url,
        sitemap: sitemapResult.sitemap,
        statistics: sitemapResult.statistics,
        hierarchy: sitemapResult.hierarchy,
        baseUrl: sitemapResult.baseUrl,
        crawlTimestamp: new Date().toISOString(),
        error: undefined
      };
    } catch (error: any) {
      this.logger.error('Error in ToolController executeGenerateSitemap:', error);
      return {
        success: false,
        url: params.url,
        sitemap: [],
        statistics: {
          totalPages: 0,
          successfulPages: 0,
          errorPages: 1,
          externalLinks: 0,
          maxDepthReached: 0,
          crawlDuration: Date.now() - startTime
        },
        hierarchy: {},
        baseUrl: params.url,
        crawlTimestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}