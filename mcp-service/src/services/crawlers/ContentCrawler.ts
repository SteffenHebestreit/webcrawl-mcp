import { Browser, Page } from 'puppeteer';
import { BaseCrawler, DynamicContentConfig } from './BaseCrawler';
import { createLogger } from '../../utils/logger';
import TurndownService from 'turndown';
import { CrawlParams, CrawlWithMarkdownParams } from '../../types/mcp';
import { CrawlResult } from '../../types/crawler';

/**
 * Crawler config interface for content crawling
 */
export interface CrawlerConfig {
    maxPages: number;
    depth: number;
    strategy: 'bfs' | 'dfs' | 'bestFirst';
    query?: string;
    waitTime?: number;
    captureNetworkTraffic?: boolean;
    captureScreenshots?: boolean;
    relevanceThreshold?: number;
    includeImages?: boolean;
    followExternalLinks?: boolean;
    extractMetadata?: boolean;
    contentFilter: "all" | "text-only" | "structured-only";
    language?: string;
    userAgent?: string;
    preserveFormatting?: boolean;
    extractTables?: boolean;
    extractCodeBlocks?: boolean;
    contentSections?: string[];
    // Enhanced dynamic content options
    dynamicContent?: DynamicContentConfig;
    enableSmartWaiting?: boolean;
}

/**
 * Crawler specialized in extracting content with advanced options
 */
export class ContentCrawler extends BaseCrawler {
    protected override logger = createLogger('ContentCrawler');
    private turndownService: TurndownService;

    constructor() {
        super();
        
        // Initialize Turndown for HTML to Markdown conversion
        this.turndownService = new TurndownService({
            headingStyle: 'atx',      // Use # style headings
            codeBlockStyle: 'fenced', // Use ```code``` style blocks
            emDelimiter: '_',         // Use _text_ for emphasis
            bulletListMarker: '-',    // Use - for bullet lists
            hr: '---',                // Use --- for horizontal rules
            strongDelimiter: '**'     // Use **text** for strong
        });
        
        // Configure turndown with custom rules
        this.configureTurndown();
    }
    
    /**
     * Configure turndown service with custom rules
     */
    private configureTurndown(): void {
        // Add any custom turndown rules here
        // For example, special handling for code blocks, tables, etc.
    }

    /**
     * Extract tables from a page
     */
    private async extractTables(page: Page): Promise<any[]> {
        return page.evaluate(() => {
            const tables: any[] = [];
            const tableElements = document.querySelectorAll('table');
            
            tableElements.forEach((table, tableIndex) => {
                const rows = table.querySelectorAll('tr');
                const tableData: any = { 
                    id: `table-${tableIndex}`, 
                    rows: [] 
                };
                
                // Try to find table caption or title
                const caption = table.querySelector('caption');
                if (caption) {
                    tableData.caption = caption.textContent?.trim();
                }
                
                // Process all rows
                rows.forEach((row, rowIndex) => {
                    const isHeader = row.parentElement?.tagName === 'THEAD' || 
                                    row.querySelectorAll('th').length > 0;
                    
                    const rowData: any = { 
                        isHeader, 
                        cells: [] 
                    };
                    
                    // Process cells in the row
                    const cells = row.querySelectorAll('th, td');
                    cells.forEach(cell => {
                        rowData.cells.push({
                            text: cell.textContent?.trim() || '',
                            colspan: cell.getAttribute('colspan') || 1,
                            rowspan: cell.getAttribute('rowspan') || 1
                        });
                    });
                    
                    tableData.rows.push(rowData);
                });
                
                tables.push(tableData);
            });
            
            return tables;
        });
    }

    /**
     * Extract images from the page with metadata
     */
    private async extractImages(page: Page, baseUrl: string): Promise<Array<{
        src: string;
        alt?: string;
        title?: string;
        caption?: string;
    }>> {
        return page.evaluate((baseUrlParam) => {
            const imagesData: Array<{
                src: string;
                alt?: string;
                title?: string;
                caption?: string;
            }> = [];
            
            const imgs = document.querySelectorAll('img[src]');
            
            imgs.forEach((img) => {
                const src = img.getAttribute('src');
                if (src) {
                    try {
                        // Resolve relative URLs
                        const absoluteSrc = new URL(src, baseUrlParam).href;
                        
                        const imgData = {
                            src: absoluteSrc,
                            alt: img.getAttribute('alt') || undefined,
                            title: img.getAttribute('title') || undefined
                        };
                          // Try to find image caption (common patterns)
                        const figure = img.closest('figure');
                        if (figure) {
                            const figcaption = figure.querySelector('figcaption');
                            if (figcaption && figcaption.textContent) {
                                (imgData as any).caption = figcaption.textContent.trim();
                            }
                        }
                        
                        imagesData.push(imgData);
                    } catch (e) {
                        // Skip invalid URLs
                    }
                }
            });
            
            return imagesData;
        }, baseUrl);
    }

    /**
     * Enhanced text extraction with better content structure preservation
     */
    private async extractEnhancedText(page: Page): Promise<{
        text: string;
        headings: string[];
        links: Array<{url: string; text: string; relevance: number}>;
        metadata: {title: string; description?: string; keywords?: string[]};
    }> {
        return page.evaluate(() => {
            // Extract metadata
            function getMetaContent(name: string): string | undefined {
                const metaTag = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
                return metaTag ? metaTag.getAttribute('content') || undefined : undefined;
            }
            
            const metadata = {
                title: document.title,
                description: getMetaContent('description'),
                keywords: getMetaContent('keywords')?.split(',').map(k => k.trim())
            };
              // Extract main content using the same approach as SitemapCrawler (which works)
            function getMainContent(): string {
                // Use innerText instead of textContent to get clean, visible text only
                // This automatically filters out CSS, scripts, and hidden content
                return document.body.innerText || '';
            }
            
            // Extract headings
            const headings: string[] = [];
            document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
                const text = heading.textContent?.trim();
                if (text) headings.push(text);
            });
            
            // Extract links with text
            const links: Array<{url: string; text: string; relevance: number}> = [];
            document.querySelectorAll('a[href]').forEach(anchor => {
                const a = anchor as HTMLAnchorElement;
                const text = a.textContent?.trim();
                if (text && text.length > 0 && a.href) {
                    // Basic relevance - will be refined later
                    links.push({ 
                        url: a.href, 
                        text, 
                        relevance: 1
                    });
                }
            });
            
            const text = getMainContent();
            
            return {
                text,
                headings,
                links,
                metadata
            };
        });
    }

    /**
     * Enhanced URL extraction with better filtering and prioritization
     */
    private async getEnhancedNextUrls(page: Page, baseUrl: string, depth: number, strategy: string, query?: string): Promise<string[]> {
        const extracted = await this.extractEnhancedText(page);
        
        // Filter links to same origin only
        const baseUrlObj = new URL(baseUrl);
        const sameOriginLinks = extracted.links.filter(link => {
            try {
                const linkUrl = new URL(link.url);
                return linkUrl.origin === baseUrlObj.origin;
            } catch (e) {
                return false;
            }
        });
        
        // If we have a query, prioritize links that seem relevant
        if (query) {
            sameOriginLinks.forEach(link => {
                // Relevance based on link text matching query
                const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
                const linkTextLower = link.text.toLowerCase();
                
                // Check for direct matches
                if (linkTextLower.includes(query.toLowerCase())) {
                    link.relevance += 2;
                }
                
                // Check for individual word matches
                queryWords.forEach(word => {
                    if (linkTextLower.includes(word)) {
                        link.relevance += 0.5;
                    }
                });
            });
        }
        
        // Sort by relevance and strategy
        let sortedLinks = sameOriginLinks.sort((a, b) => b.relevance - a.relevance);
        
        switch (strategy) {
            case 'dfs':
                // For DFS, we prioritize deeper paths
                sortedLinks = sortedLinks.sort((a, b) => {
                    const aDepth = a.url.split('/').length;
                    const bDepth = b.url.split('/').length;
                    return bDepth - aDepth;
                });
                break;
                
            case 'bfs':
                // For BFS, we prioritize shallow paths
                sortedLinks = sortedLinks.sort((a, b) => {
                    const aDepth = a.url.split('/').length;
                    const bDepth = b.url.split('/').length;
                    return aDepth - bDepth;
                });
                break;
                
            case 'bestFirst':
            default:
                // Already sorted by relevance above
                break;
        }
        
        return sortedLinks.map(link => link.url);
    }

    /**
     * Crawl a single URL and extract content.
     */
    private async crawlUrl(
        browser: Browser,
        url: string, 
        config: CrawlerConfig, 
        visitedUrls: Set<string> = new Set(), 
        currentDepth: number = 0
    ): Promise<{
        success: boolean;
        text: string;
        markdown: string;
        media: { tables: any[] };
        visitedUrls: Set<string>;
        screenshots?: string[];
        images?: Array<{
            src: string;
            alt?: string;
            title?: string;
            caption?: string;
        }>;
    }> {
        const maxDepth = config.depth || 3;
        const maxPages = config.maxPages || 10;
        const waitTime = config.waitTime || 2000;
        const captureScreenshots = config.captureScreenshots || false;
        const captureNetworkTraffic = config.captureNetworkTraffic || false;
        
        // Initialize result object
        const result = {
            success: false,
            text: '',
            markdown: '',
            media: { tables: [] as any[] },
            visitedUrls,
            screenshots: [] as string[],
            networkRequests: [] as string[],
            images: [] as Array<{
                src: string;
                alt?: string;
                title?: string;
                caption?: string;
            }>,
        };
        
        // Stop if we've reached the maximum number of pages
        if (visitedUrls.size >= maxPages) {
            result.text = `Reached maximum page limit of ${maxPages}.`;
            return result;
        }
        
        // Avoid crawling the same URL twice
        if (visitedUrls.has(url)) {
            result.text = `URL ${url} has already been visited.`;
            return result;
        }
        
        let page: Page | null = null;
        
        try {
            page = await this.createStandardPage(browser);
            
            await page.setExtraHTTPHeaders({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'max-age=0'
            });
            
            // Enable request interception to skip non-essential resources
            await page.setRequestInterception(true);
            
            page.on('request', (request) => {
                const resourceType = request.resourceType();
                if (captureNetworkTraffic) {
                    result.networkRequests.push(`${resourceType}: ${request.url()}`);
                }
                
                // Skip non-essential resources for faster loading
                if (['image', 'stylesheet', 'font', 'media'].includes(resourceType) && !config.includeImages) {
                    request.abort();
                } else {
                    request.continue();
                }
            });
            
            // Enhanced error handling for page events
            page.on('error', (error) => {
                this.logger.warn(`Page error for ${url}:`, error.message);
            });
            
            page.on('pageerror', (error) => {
                this.logger.warn(`Page script error for ${url}:`, error.message);
            });              // Use enhanced navigation with dynamic content detection
            const dynamicConfig: DynamicContentConfig = config.dynamicContent || {
                maxWaitTime: 30000, // Increased to match SitemapCrawler timeout
                detectDomMutations: config.enableSmartWaiting !== false,
                detectJsFrameworks: config.enableSmartWaiting !== false,
                waitForNetworkIdle: config.enableSmartWaiting !== false,
                enableSimpleFallback: true, // Enable fallback by default
                simpleFallbackTimeout: 30000 // Match SitemapCrawler timeout
            };
            
            const navigationSuccessful = await this.navigateWithDynamicContent(page, url, dynamicConfig);
            
            // Wait for the page to load properly
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Mark this URL as visited
            visitedUrls.add(url);
            
            // Enhanced content extraction with target closed error handling
            this.logger.info(`Extracting enhanced content from ${url}`);
            let extractedContent;
            try {
                // Check if page is still valid before extraction
                if (page.isClosed()) {
                    throw new Error('Page was closed before content extraction');
                }
                
                extractedContent = await this.extractContentWithDynamicDetection(page, config);
                result.text = extractedContent.text;
            } catch (error: any) {
                if (error.message.includes('Target closed') || error.message.includes('Page was closed')) {
                    this.logger.warn(`Page was closed during content extraction from ${url}, attempting to reopen`);
                    return result;
                } else {
                    this.logger.error(`Failed to extract content from ${url}:`, error.message);
                    result.text = `Failed to extract content: ${error.message}`;
                }
            }
            
            // If there's a query, perform search within the content
            if (config.query && result.text) {
                const searchResults = this.searchInContent(result.text, config.query);
                result.text = searchResults.summary || result.text;
            }
            
            // Convert HTML to Markdown with error handling
            try {
                if (!page.isClosed()) {
                    const html = await page.content();
                    result.markdown = this.turndownService.turndown(html);
                } else {
                    this.logger.warn(`Page was closed before markdown conversion for ${url}`);
                    result.markdown = `# ${url}\n\n${result.text}`;
                }
            } catch (error: any) {
                this.logger.warn(`Failed to extract HTML for markdown conversion from ${url}:`, error.message);
                result.markdown = `# ${url}\n\n${result.text}`;
            }
            
            // Extract tables with error handling
            try {
                if (!page.isClosed()) {
                    result.media.tables = await this.extractTables(page);
                }
            } catch (error: any) {
                this.logger.warn(`Failed to extract tables from ${url}:`, error.message);
                result.media.tables = [];
            }
            
            // Extract images if configured
            if (config.includeImages) {
                try {
                    if (!page.isClosed()) {
                        result.images = await this.extractImages(page, url);
                    }
                } catch (error: any) {
                    this.logger.warn(`Failed to extract images from ${url}:`, error.message);
                    result.images = [];
                }
            }
            
            // Take screenshot if configured
            if (captureScreenshots) {
                try {
                    if (!page.isClosed()) {
                        const screenshotPath = await this.takeScreenshot(page, url);
                        result.screenshots.push(screenshotPath);
                    }
                } catch (error: any) {
                    this.logger.warn(`Failed to take screenshot of ${url}:`, error.message);
                }
            }
            
            // If we haven't reached max depth, get links for next pages
            if (currentDepth < maxDepth) {
                try {
                    if (!page.isClosed()) {
                        const nextUrls = await this.getEnhancedNextUrls(
                            page, 
                            url, 
                            currentDepth, 
                            config.strategy, 
                            config.query
                        );
                        
                        // Limit to avoid excessive crawling
                        const urlLimit = Math.min(10, maxPages - visitedUrls.size);
                        const limitedUrls = nextUrls.slice(0, urlLimit);
                        
                        // Recursively crawl next URLs
                        for (const nextUrl of limitedUrls) {
                            if (visitedUrls.size >= maxPages) break;
                            
                            await this.crawlUrl(
                                browser,
                                nextUrl, 
                                config, 
                                visitedUrls, 
                                currentDepth + 1
                            );
                        }
                    }
                } catch (error: any) {
                    this.logger.warn(`Failed to extract next URLs from ${url}:`, error.message);
                }
            }

            result.success = true;
            
        } catch (error: any) {
            this.logger.error(`Error while crawling ${url}:`, error);
            // Categorize the error for better user understanding
            let errorMessage = error.message;
            
            if (error.message.includes('ERR_CONNECTION_CLOSED')) {
                errorMessage = 'Connection was closed by the server. The website may be down or blocking automated requests.';
            } else if (error.message.includes('ERR_CONNECTION_TIMED_OUT')) {
                errorMessage = 'Connection timed out. The website may be slow or unreachable.';
            } else if (error.message.includes('ERR_NAME_NOT_RESOLVED')) {
                errorMessage = 'Domain name could not be resolved. Check if the URL is correct.';
            } else if (error.message.includes('ERR_CONNECTION_REFUSED')) {
                errorMessage = 'Connection was refused. The server may be down or not accepting connections.';
            } else if (error.message.includes('Navigation failed after')) {
                errorMessage = 'Failed to navigate to the page after multiple attempts. The website may be experiencing issues.';
            } else if (error.message.includes('HTTP 4') || error.message.includes('HTTP 5')) {
                errorMessage = `Server returned an error: ${error.message}`;
            } else if (error.message.includes('Target closed')) {
                errorMessage = 'The page was closed unexpectedly during crawling. This may be due to page instability or anti-bot measures.';
            }
            
            return {
                ...result,
                success: false,
                text: `Failed to crawl ${url}: ${errorMessage}`,
                markdown: `# Error\n\nFailed to crawl ${url}: ${errorMessage}`,
            };
        } finally {
            if (page && !page.isClosed()) {
                await page.close();
            }
        }
        return result;
    }

    /**
     * Enhanced content extraction with dynamic content detection
     */
    private async extractContentWithDynamicDetection(page: Page, config: CrawlerConfig): Promise<{
        text: string;
        headings: string[];
        links: Array<{url: string; text: string; relevance: number}>;
        metadata: {title: string; description?: string; keywords?: string[]};
    }> {
        // Wait for additional dynamic content if enabled
        if (config.enableSmartWaiting !== false) {
            await this.waitForSmartContent(page, config);
        }
        
        return this.extractEnhancedText(page);
    }

    /**
     * Smart content waiting that adapts to the page's characteristics
     */
    private async waitForSmartContent(page: Page, config: CrawlerConfig): Promise<void> {
        this.logger.info('Starting smart content detection...');
        
        try {
            // Analyze page to determine appropriate waiting strategy
            const pageCharacteristics = await page.evaluate(() => {
                const characteristics = {
                    hasReact: !!(window as any).React || document.querySelector('[data-reactroot], #root'),
                    hasVue: !!(window as any).Vue || document.querySelector('[data-server-rendered]'),
                    hasAngular: !!(window as any).ng || document.querySelector('[ng-app], [data-ng-app]'),
                    hasJQuery: !!(window as any).jQuery,
                    hasLoadingIndicators: document.querySelectorAll('.loading, .spinner, .loader, [class*="loading"]').length > 0,
                    hasLazyImages: document.querySelectorAll('img[loading="lazy"], img[data-src]').length > 0,
                    scriptCount: document.querySelectorAll('script').length,
                    hasInfiniteScroll: document.body.textContent?.toLowerCase().includes('load more') || 
                                      document.body.textContent?.toLowerCase().includes('show more') ||
                                      document.querySelector('[data-infinite-scroll]') !== null,
                    contentHeight: document.body.scrollHeight,
                    viewportHeight: window.innerHeight
                };
                
                return characteristics;
            });
            
            this.logger.debug('Page characteristics:', pageCharacteristics);
            
            // Determine dynamic content configuration based on page characteristics
            const dynamicConfig: DynamicContentConfig = {
                maxWaitTime: 10000,
                detectDomMutations: true,
                detectJsFrameworks: !!(pageCharacteristics.hasReact || pageCharacteristics.hasVue || pageCharacteristics.hasAngular),
                waitForNetworkIdle: pageCharacteristics.scriptCount > 10,
                ...config.dynamicContent
            };
            
            // Add framework-specific selectors
            const frameworkSelectors: string[] = [];
            if (pageCharacteristics.hasReact) {
                frameworkSelectors.push('[data-reactroot]', '#root', '.react-root');
            }
            if (pageCharacteristics.hasVue) {
                frameworkSelectors.push('[data-server-rendered]', '#app', '.vue-app');
            }
            if (pageCharacteristics.hasAngular) {
                frameworkSelectors.push('[ng-app]', '[data-ng-app]', '.ng-scope');
            }
            
            if (frameworkSelectors.length > 0) {
                dynamicConfig.waitForSelectors = frameworkSelectors;
            }
            
            // Handle infinite scroll detection
            if (pageCharacteristics.hasInfiniteScroll) {
                await this.handleInfiniteScroll(page);
            }
            
            // Handle lazy loading images
            if (pageCharacteristics.hasLazyImages) {
                await this.triggerLazyImageLoading(page);
            }
            
            // Wait for dynamic content using the enhanced method
            await this.waitForDynamicContent(page, dynamicConfig);
            
        } catch (error: any) {
            this.logger.warn('Smart content detection failed:', error.message);
            // Fall back to basic waiting
            await new Promise(resolve => setTimeout(resolve, config.waitTime || 2000));
        }
    }

    /**
     * Handle infinite scroll by triggering scroll events to load more content
     */
    private async handleInfiniteScroll(page: Page, maxScrolls: number = 3): Promise<void> {
        this.logger.debug('Handling infinite scroll...');
        
        try {
            let scrollCount = 0;
            let previousHeight = 0;
            
            while (scrollCount < maxScrolls) {
                // Get current page height
                const currentHeight = await page.evaluate(() => document.body.scrollHeight);
                
                if (currentHeight === previousHeight) {
                    // No new content loaded, stop scrolling
                    break;
                }
                
                previousHeight = currentHeight;
                
                // Scroll to bottom
                await page.evaluate(() => {
                    window.scrollTo(0, document.body.scrollHeight);
                });
                
                // Wait for new content to load
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Look for "load more" buttons and click them
                const loadMoreClicked = await page.evaluate(() => {
                    const loadMoreButtons = Array.from(document.querySelectorAll('button, a')).filter(btn => {
                        const text = btn.textContent?.toLowerCase() || '';
                        return text.includes('load more') || text.includes('show more') || text.includes('see more');
                    });
                    
                    if (loadMoreButtons.length > 0) {
                        (loadMoreButtons[0] as HTMLElement).click();
                        return true;
                    }
                    return false;
                });
                
                if (loadMoreClicked) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
                
                scrollCount++;
            }
            
            // Scroll back to top
            await page.evaluate(() => window.scrollTo(0, 0));
            
        } catch (error: any) {
            this.logger.debug('Error handling infinite scroll:', error.message);
        }
    }

    /**
     * Trigger lazy image loading by scrolling through the page
     */
    private async triggerLazyImageLoading(page: Page): Promise<void> {
        this.logger.debug('Triggering lazy image loading...');
        
        try {
            await page.evaluate(() => {
                return new Promise<void>((resolve) => {
                    let scrollY = 0;
                    const scrollHeight = document.body.scrollHeight;
                    const viewportHeight = window.innerHeight;
                    const scrollStep = viewportHeight / 2;
                    
                    const scrollNext = () => {
                        scrollY += scrollStep;
                        window.scrollTo(0, scrollY);
                        
                        if (scrollY >= scrollHeight) {
                            // Scroll back to top and resolve
                            window.scrollTo(0, 0);
                            setTimeout(resolve, 500);
                        } else {
                            setTimeout(scrollNext, 300);
                        }
                    };
                    
                    scrollNext();
                });
            });
        } catch (error: any) {
            this.logger.debug('Error triggering lazy image loading:', error.message);
        }
    }

    /**
     * Public method to initiate a crawl operation
     */
    public async executeCrawl(url: string, options: CrawlParams | CrawlWithMarkdownParams): Promise<CrawlResult> {
        this.logger.info(`Initiating crawl for URL: ${url}`, options);
        const browser = await this.launchBrowser();
        try {
            await this.ensureTmpDir();
            const config: CrawlerConfig = {
                maxPages: options.maxPages || 5,
                depth: options.depth || 2,
                strategy: options.strategy || 'bestFirst',
                query: 'query' in options ? options.query : undefined,
                waitTime: 'waitTime' in options ? options.waitTime : 2000,
                captureNetworkTraffic: 'captureNetworkTraffic' in options ? options.captureNetworkTraffic : false,
                captureScreenshots: 'captureScreenshots' in options ? options.captureScreenshots : false,
                relevanceThreshold: 'relevanceThreshold' in options ? options.relevanceThreshold : 2,
                includeImages: 'includeImages' in options ? options.includeImages : false,
                followExternalLinks: 'followExternalLinks' in options ? options.followExternalLinks : false,
                extractMetadata: 'extractMetadata' in options ? options.extractMetadata : true,
                contentFilter: ('contentFilter' in options && options.contentFilter) ? options.contentFilter as "all" | "text-only" | "structured-only" : 'all',
                language: 'language' in options ? options.language : undefined,
                userAgent: 'userAgent' in options ? options.userAgent : undefined,
                preserveFormatting: 'preserveFormatting' in options ? options.preserveFormatting : true,
                extractTables: 'extractTables' in options ? options.extractTables : true,
                extractCodeBlocks: 'extractCodeBlocks' in options ? options.extractCodeBlocks : true,
                contentSections: 'contentSections' in options ? options.contentSections : undefined,
            };
            
            // Execute the crawl, passing the browser instance
            const crawlResult = await this.crawlUrl(browser, url, config);
            
            // Format the result
            const result: CrawlResult = {
                success: crawlResult.success,
                url,
                text: crawlResult.text,
                markdown: crawlResult.markdown,
                media: { 
                    tables: crawlResult.media.tables 
                },
                images: crawlResult.images,
            };
            
            this.logger.info(`Crawl completed for ${url}`);
            return result;
        } catch (error: any) {
            this.logger.error(`executeCrawl failed for ${url}:`, error);
            // Return error response
            return {
                success: false,
                url: url,
                error: error.message || 'An unknown error occurred during crawl execution.',
                traceback: error.stack || 'No traceback available.',
                markdown: `# Error\n\n${error.message || 'An unknown error occurred.'}`,
                text: `Error: ${error.message || 'An unknown error occurred.'}`
            };
        } finally {
            if (browser) {
                await browser.close();
                this.logger.info(`Browser closed for executeCrawl operation on ${url}`);
            }
        }
    }
}
