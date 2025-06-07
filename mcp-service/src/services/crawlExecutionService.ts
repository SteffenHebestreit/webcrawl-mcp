import { 
    CrawlParams, 
    CrawlWithMarkdownParams, 
    SitemapGeneratorParams, 
    SitemapGeneratorResponse,
    WebSearchParams,
    WebSearchResponse
} from '../types/mcp';
import { CrawlResult, WebSearchResult } from '../types/crawler';
import { createLogger } from '../utils/logger';
import { ContentCrawler, LinkCrawler, SitemapCrawler, WebSearchCrawler } from './crawlers';

/**
 * Service responsible for executing web crawls using specialized crawlers
 * This class acts as a facade for the specialized crawler implementations
 */
export class CrawlExecutionService {
    private contentCrawler: ContentCrawler;
    private linkCrawler: LinkCrawler;
    private sitemapCrawler: SitemapCrawler;
    private webSearchCrawler: WebSearchCrawler;
    private logger = createLogger('CrawlExecutionService');

    constructor() {
        this.contentCrawler = new ContentCrawler();
        this.linkCrawler = new LinkCrawler();
        this.sitemapCrawler = new SitemapCrawler();
        this.webSearchCrawler = new WebSearchCrawler();
    }

    /**
     * Search within crawled content using simple text matching
     */
    public searchInContent(content: string, query: string): {
        matches: Array<{snippet: string; position: number; relevance: number}>;
        summary: string;
    } {
        return this.contentCrawler.searchInContent(content, query);
    }

    /**
     * Public method to initiate a crawl operation
     */
    public async executeCrawl(url: string, options: CrawlParams | CrawlWithMarkdownParams): Promise<CrawlResult> {
        this.logger.info(`Initiating crawl for URL: ${url}`);
        return this.contentCrawler.executeCrawl(url, options);
    }
    
    /**
     * Extract all internal links from a page without following external links
     */
    public async extractInternalLinks(
        url: string,
        includeFragments: boolean = true,
        includeQueryParams: boolean = true,
        categorizeLinks: boolean = true,
        maxLinks: number = 100
    ): Promise<{
        success: boolean;
        url: string;
        links: Array<{
            url: string;
            text: string;
            title?: string;
            type: "navigation" | "content" | "media" | "form" | "other";
            depth: number;
            section?: string;
        }>;
        pageTitle?: string;
        baseUrl: string;
        error?: string;
    }> {
        this.logger.info(`Extracting internal links from: ${url}`);
        return this.linkCrawler.extractInternalLinks(
            url, 
            includeFragments, 
            includeQueryParams, 
            categorizeLinks, 
            maxLinks
        );
    }

    /**
     * Generate a comprehensive sitemap by crawling a website
     * @param url The URL to generate sitemap for
     * @param depth The depth of crawling (default: 2)
     * @param maxPages Maximum number of pages to include (default: 50)
     * @param includeExternalLinks Whether to include external links (default: false)
     * @param respectRobotsTxt Whether to respect robots.txt (default: true)
     * @param followRedirects Whether to follow redirects (default: true)
     * @param excludePatterns URL patterns to exclude (default: [])
     * @param includeMetadata Whether to include page metadata (default: true)
     * @returns A SitemapGeneratorResponse with sitemap data
     */
    public async generateSitemap(
        url: string,
        depth: number = 2,
        maxPages: number = 50,
        includeExternalLinks: boolean = false,
        respectRobotsTxt: boolean = true,
        followRedirects: boolean = true,
        excludePatterns: string[] = [],
        includeMetadata: boolean = true
    ): Promise<SitemapGeneratorResponse> {
        this.logger.info(`Generating sitemap for: ${url}`);
        return this.sitemapCrawler.generateSitemap(
            url,
            depth,
            maxPages,
            includeExternalLinks,
            respectRobotsTxt,
            followRedirects,
            excludePatterns,
            includeMetadata
        );
    }

    /**
     * Execute a web search query using the specified search engine
     * @param query The search query
     * @param engine The search engine to use (default: duckduckgo)
     * @param numResults Maximum number of results to return (default: 10)
     * @param safeSearch Whether to enable safe search filtering (default: true)
     * @param timeRange Optional time range filter
     * @returns Web search results with title, URL, and snippet
     */
    public async executeWebSearch(
        query: string,
        engine: 'google' | 'duckduckgo' | 'searxng' = 'duckduckgo',
        numResults: number = 10,
        safeSearch: boolean = true,
        timeRange?: 'day' | 'week' | 'month' | 'year'
    ): Promise<WebSearchResponse> {
        this.logger.info(`Starting web search for query: "${query}" using ${engine}`);
        
        try {
            const result = await this.webSearchCrawler.executeWebSearch(
                query,
                engine,
                numResults,
                safeSearch,
                timeRange
            );

            return {
                success: result.success,
                query: result.query,
                engine: result.engine,
                results: result.results,
                totalResults: result.results.length,
                searchTimeMs: result.timeMs,
                error: result.error
            };
        } catch (error: any) {
            this.logger.error(`Error in executeWebSearch: ${error.message}`);
            return {
                success: false,
                query,
                engine,
                results: [],
                totalResults: 0,
                searchTimeMs: 0,
                error: error.message
            };
        }
    }
}
