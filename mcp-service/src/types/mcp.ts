import Joi from 'joi'; // Changed from 'zod';

/**
 * MCP Server configuration options
 */
export interface McpServerOptions {
  name: string;
  version: string;
  description: string;
}

/**
 * MCP Resource configuration
 */
export interface ResourceConfig {
  name: string;
  uri: string;
  handlers: {
    list?: () => Promise<ResourceListResponse>;
    get?: () => Promise<ResourceGetResponse>;
  };
}

/**
 * MCP Tool configuration
 */
export interface ToolConfig<P, R> {
  name: string;
  parameters: Joi.Schema; // Changed from z.ZodType<P>
  returns: Joi.Schema;    // Changed from z.ZodType<R>
  execute: (params: P) => Promise<R>;
  description: string;
  parameterDescription: string;
  returnDescription: string;
}

/**
 * Response for resource list operation
 */
export interface ResourceListResponse {
  uris: string[];
}

/**
 * Content item in a resource get response
 */
export interface ResourceContentItem {
  uri: string;
  text: string;
}

/**
 * Response for resource get operation
 */
export interface ResourceGetResponse {
  contents: ResourceContentItem[];
}

/**
 * Common parameter interfaces for crawl tools
 */
export interface CrawlParams {
  url: string;
  query: string; // Required query to guide the crawling process
  maxPages?: number; // Default: 5 (LLM can specify for larger crawls)
  depth?: number; // Default: 2 (LLM can increase for deeper exploration)
  strategy?: "bfs" | "dfs" | "bestFirst"; // Default: "bestFirst" (relevance-based)
  captureNetworkTraffic?: boolean; // Default: false (LLM can enable for debugging)
  captureScreenshots?: boolean; // Default: false (LLM can enable for visual context)
  waitTime?: number; // Default: 2000ms (LLM can adjust for slow sites)
  relevanceThreshold?: number; // Default: 2 (minimum relevance score for content inclusion)
  includeImages?: boolean; // Default: false (LLM can enable to extract image information)
  followExternalLinks?: boolean; // Default: false (LLM can enable to crawl external domains)
  extractMetadata?: boolean; // Default: true (extract page titles, descriptions, keywords)
  contentFilter?: "all" | "text-only" | "structured-only"; // Default: "all"
  language?: string; // Optional language hint for better content extraction
  userAgent?: string; // Optional custom user agent string
}

export interface CrawlWithMarkdownParams {
  url: string;
  query?: string; // Optional query to focus the markdown content extraction
  maxPages?: number; // Default: 3 (smaller for markdown focused extraction)
  depth?: number; // Default: 1 (usually single page for markdown)
  strategy?: "bfs" | "dfs" | "bestFirst"; // Default: "bestFirst"
  includeImages?: boolean; // Default: false (LLM can enable to include image references)
  preserveFormatting?: boolean; // Default: true (maintain original HTML structure in markdown)
  extractTables?: boolean; // Default: true (convert HTML tables to markdown tables)
  extractCodeBlocks?: boolean; // Default: true (preserve code formatting)
  contentSections?: string[]; // Optional array of specific sections to extract (e.g., ["main", "article", ".content"])
}

/**
 * Response interfaces for crawl tools
 */
export interface CrawlResponse {
  success: boolean;
  url: string;
  query: string; // Echo back the query that guided the crawl
  text: string;
  tables?: any[];
  images?: Array<{
    src: string;
    alt?: string;
    title?: string;
    caption?: string;
  }>;
  metadata?: {
    title?: string;
    description?: string;
    keywords?: string[];
    language?: string;
    author?: string;
    publishDate?: string;
  };
  links?: Array<{
    url: string;
    text: string;
    relevance: number;
  }>;
  contentSummary?: string; // LLM-friendly summary of the content in relation to the query
  relevanceScore?: number; // Overall relevance of the crawled content to the query
  pagesVisited?: number; // Number of pages actually crawled
  totalContentLength?: number; // Total character count of extracted content
  processingTime?: number; // Time taken to complete the crawl (in milliseconds)
  error?: string;
}

export interface CrawlWithMarkdownResponse {
  success: boolean;
  url: string;
  query: string; // Echo back the query that guided the markdown extraction (or the default query)
  markdown: string;
  tableOfContents?: string[]; // Extracted headings for navigation
  codeBlocks?: Array<{
    language?: string;
    content: string;
    lineCount: number;
  }>;
  images?: Array<{
    src: string;
    alt?: string;
    markdownReference: string; // The markdown image reference
  }>;
  links?: Array<{
    url: string;
    text: string;
    type: "internal" | "external";
  }>;
  contentSummary?: string; // Summary of the markdown content
  wordCount?: number; // Word count of the markdown content
  estimatedReadingTime?: number; // Estimated reading time in minutes
  error?: string;
}

/**
 * Search tool parameter and response interfaces
 */
export interface SearchInPageParams {
  url: string;
  query: string;
  maxResults?: number;
}

export interface SearchInPageResponse {
  success: boolean;
  url: string;
  query: string;
  matches: Array<{
    snippet: string;
    position: number;
    relevance: number;
  }>;
  summary: string;
  totalMatches: number;
  error?: string;
  processingTime?: number; // Time in milliseconds taken to process the request
}

export interface SmartCrawlParams {
  url: string;
  query: string;
  maxPages?: number;
  depth?: number;
  relevanceThreshold?: number;
}

export interface SmartCrawlResponse {
  success: boolean;
  url: string;
  query: string;
  relevantPages: Array<{
    url: string;
    title: string;
    summary: string;
    relevanceScore: number;
    keyFindings: string[];
  }>;
  overallSummary: string;
  error?: string;
  processingTime?: number; // Time in milliseconds taken to process the request
}

export interface ExtractLinksParams {
  url: string;
  includeFragments?: boolean; // Include links with URL fragments (#section)
  includeQueryParams?: boolean; // Include links with query parameters (?param=value)
  categorizeLinks?: boolean; // Categorize links by type (navigation, content, etc.)
  includeExternalLinks?: boolean; // Include external links (links to other domains)
  maxLinks?: number; // Maximum number of links to return
  sortBy?: "url" | "text" | "relevance"; // How to sort the results
}

export interface ExtractLinksResponse {
  success: boolean;
  url: string;
  links: Array<{
    url: string;
    text: string;
    title?: string; // Link title attribute
    type: "navigation" | "content" | "media" | "form" | "other";
    depth: number; // URL path depth (number of segments)
    section?: string; // Which section of the page the link was found in
    isExternal: boolean; // Whether the link points to an external domain
  }>;
  linksByType?: {
    navigation: number;
    content: number;
    media: number;
    form: number;
    other: number;
  };
  processingTime?: number; // Time in milliseconds taken to process the request
  totalLinks: number;
  internalLinks: number; // Count of internal links
  externalLinks: number; // Count of external links
  pageTitle?: string;
  baseUrl: string;
  error?: string;
}

export interface SitemapGeneratorParams {
  url: string;
  depth?: number; // Default: 2 (how many levels deep to crawl)
  maxPages?: number; // Default: 50 (maximum pages to include in sitemap)
  includeExternalLinks?: boolean; // Default: false (whether to include external links)
  respectRobotsTxt?: boolean; // Default: true (respect robots.txt directives)
  followRedirects?: boolean; // Default: true (follow HTTP redirects)
  excludePatterns?: string[]; // URL patterns to exclude (e.g., ["/admin/", ".pdf"])
  includeMetadata?: boolean; // Default: true (extract page metadata)
}

export interface SitemapGeneratorResponse {
  success: boolean;
  url: string;
  sitemap: Array<{
    url: string;
    title?: string;
    description?: string;
    depth: number;
    parentUrl?: string;
    status: "crawled" | "error" | "excluded" | "external";
    lastModified?: string;
    contentType?: string;
    wordCount?: number;
    headings?: {
      h1?: string[];
      h2?: string[];
      h3?: string[];
    };
    error?: string;
  }>;
  statistics: {
    totalPages: number;
    successfulPages: number;
    errorPages: number;
    externalLinks: number;
    maxDepthReached: number;
    crawlDuration: number;
  };
  hierarchy: {
    [url: string]: string[]; // URL -> array of child URLs
  };  baseUrl: string;
  crawlTimestamp: string;
  error?: string;
  processingTime?: number; // Time in milliseconds taken to process the request
}

/**
 * Web search tool parameter and response interfaces
 */
export interface WebSearchParams {
    query: string;
    engine?: 'google' | 'duckduckgo' | 'searxng';
    numResults?: number;
    safeSearch?: boolean;
    timeRange?: 'day' | 'week' | 'month' | 'year';
}

export interface WebSearchResponse {
    success: boolean;
    query: string;
    engine: 'google' | 'duckduckgo' | 'searxng';
    results: Array<{
        title: string;
        url: string;
        snippet: string;
        position: number;
    }>;
    totalResults: number;
    searchTimeMs: number;
    error?: string;
}

/**
 * Date/time utility tool parameter and response interfaces
 */
export interface DateTimeParams {
    city?: string; // Optional city name to determine timezone (default: Berlin)
    format?: 'iso' | 'human' | 'both'; // Output format preference (default: both)
    includeTimezone?: boolean; // Include timezone information (default: true)
}

export interface DateTimeResponse {
    success: boolean;
    city: string;
    timezone: string;
    currentDateTime: {
        iso: string; // ISO 8601 format (e.g., "2024-01-15T14:30:45.123Z")
        human: string; // Human-readable format (e.g., "Monday, January 15, 2024 at 2:30 PM")
        utc: string; // UTC time for reference
    };
    additionalInfo: {
        dayOfWeek: string;
        dayOfYear: number;
        weekOfYear: number;
        quarter: number;
        isDaylightSaving?: boolean;
        timezoneOffset: string; // e.g., "+01:00"
    };
    error?: string;
}