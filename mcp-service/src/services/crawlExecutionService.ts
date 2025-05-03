import { promises as fs } from 'fs';
import path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer';
import TurndownService from 'turndown';
import { CrawlParams, CrawlWithMarkdownParams } from '../types/mcp';
import { createLogger } from '../utils/logger';

// Define the structure of the crawl result
interface CrawlResult {
    success: boolean;
    url: string;
    markdown?: string;
    text?: string;
    media?: { tables?: any[] };
    error?: string;
    traceback?: string;
}

// Crawler configuration
interface CrawlerConfig {
    maxPages: number;
    depth: number;
    strategy: 'bfs' | 'dfs' | 'bestFirst';
    query?: string;
    waitTime?: number;
    captureNetworkTraffic?: boolean;
    captureScreenshots?: boolean;
}

/**
 * Service responsible for executing web crawls using Puppeteer
 */
export class CrawlExecutionService {
    private browser: Browser | null = null;
    private tmpDir: string;
    private turndownService: TurndownService;
    private logger = createLogger('CrawlExecutionService');

    constructor() {
        // Define temporary directory for screenshots and other artifacts
        this.tmpDir = path.join(process.cwd(), '.tmp', 'crawl-artifacts');
        
        // Initialize Turndown for HTML to Markdown conversion
        this.turndownService = new TurndownService({
            headingStyle: 'atx',      // Use # style headings
            codeBlockStyle: 'fenced', // Use ```code``` style blocks
            emDelimiter: '_',         // Use _text_ for emphasis
            bulletListMarker: '-',    // Use - for bullet lists
            hr: '---',                // Use --- for horizontal rules
            strongDelimiter: '**'     // Use **text** for strong
        });

        // Custom formatting rules for markdown
        this.configureTurndown();
        
        // Ensure the temporary directory exists
        this.ensureTmpDir().catch(err => this.logger.error('Failed to create temp directory', err));
    }

    /**
     * Configure turndown service with custom rules
     */
    private configureTurndown(): void {
        // Preserve table structure
        this.turndownService.addRule('tableRule', {
            filter: ['table'],
            replacement: (content, node) => {
                // Simplified table conversion - for complex tables this would need enhancement
                return '\n\n' + content + '\n\n';
            }
        });

        // Improve code block handling
        this.turndownService.addRule('codeBlock', {
            filter: ['pre'],
            replacement: (content, node) => {
                return '\n```\n' + content.trim() + '\n```\n';
            }
        });
    }

    /**
     * Ensures the temporary directory exists
     */
    private async ensureTmpDir(): Promise<void> {
        try {
            await fs.mkdir(this.tmpDir, { recursive: true });
            this.logger.info(`Temporary directory ensured at: ${this.tmpDir}`);
        } catch (error) {
            this.logger.error('Error creating temporary directory:', error);
            throw new Error(`Failed to create temporary directory: ${error}`);
        }
    }

    /**
     * Initialize and return browser instance
     */
    private async getBrowser(): Promise<Browser> {
        if (!this.browser) {
            this.logger.info('Launching new browser instance');
            
            const launchOptions = {
                headless: true, // Use boolean instead of string
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1280,720',
                ],
                defaultViewport: { width: 1280, height: 720 },
            };
            
            this.browser = await puppeteer.launch(launchOptions);
            
            // Handle unexpected browser closure
            this.browser.on('disconnected', () => {
                this.logger.info('Browser disconnected');
                this.browser = null;
            });
        }
        
        return this.browser;
    }

    /**
     * Extracts tables from the page
     */
    private async extractTables(page: Page): Promise<any[]> {
        const tables = await page.evaluate(() => {
            const tablesData: any[] = [];
            const tables = document.querySelectorAll('table');
            
            tables.forEach((table, tableIndex) => {
                const tableData: any = {
                    rows: [],
                    caption: table.querySelector('caption')?.textContent || null,
                };
                
                const rows = table.querySelectorAll('tr');
                rows.forEach((row, rowIndex) => {
                    const rowData: string[] = [];
                    const cells = row.querySelectorAll('th, td');
                    cells.forEach((cell) => {
                        rowData.push(cell.textContent?.trim() || '');
                    });
                    tableData.rows.push(rowData);
                });
                
                tablesData.push(tableData);
            });
            
            return tablesData;
        });
        
        return tables;
    }

    /**
     * Takes a screenshot of the current page
     */
    private async takeScreenshot(page: Page, url: string, index: number = 0): Promise<string> {
        const screenshotPath = path.join(
            this.tmpDir, 
            `screenshot-${Date.now()}-${index}-${url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}.png`
        );
        
        try {
            await page.screenshot({
                path: screenshotPath,
                fullPage: true,
            });
            this.logger.info(`Screenshot saved to ${screenshotPath}`);
            return screenshotPath;
        } catch (error) {
            this.logger.error(`Failed to take screenshot:`, error);
            return '';
        }
    }

    /**
     * Extract text content from the page
     */
    private async extractText(page: Page): Promise<string> {
        // Get all visible text from the page
        const textContent = await page.evaluate(() => {
            // Helper function to get visible text
            function getVisibleText(element: Element): string {
                if (!element) return '';
                
                // Skip hidden elements
                const style = window.getComputedStyle(element);
                if (style.display === 'none' || style.visibility === 'hidden') {
                    return '';
                }
                
                // Skip script and style elements
                if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') {
                    return '';
                }
                
                // Get text for this element
                let text = '';
                if (element.nodeType === Node.TEXT_NODE) {
                    text = element.textContent?.trim() || '';
                }
                
                // Process child nodes
                for (const child of Array.from(element.childNodes)) {
                    if (child.nodeType === Node.ELEMENT_NODE) {
                        text += ' ' + getVisibleText(child as Element);
                    } else if (child.nodeType === Node.TEXT_NODE) {
                        text += ' ' + (child.textContent?.trim() || '');
                    }
                }
                
                return text.replace(/\s+/g, ' ').trim();
            }
            
            // Start with the body element
            return getVisibleText(document.body);
        });
        
        return textContent;
    }

    /**
     * Get the URLs for the next pages to crawl based on the current page and crawl strategy
     */
    private async getNextUrls(page: Page, baseUrl: string, depth: number, strategy: string): Promise<string[]> {
        // Extract all links on the current page
        const links = await page.evaluate((baseUrl) => {
            const urls: string[] = [];
            const anchors = document.querySelectorAll('a[href]');
            
            anchors.forEach((anchor) => {
                const href = anchor.getAttribute('href');
                if (!href) return;
                
                try {
                    // Convert to absolute URL
                    const absoluteUrl = new URL(href, baseUrl).href;
                    
                    // Only include same-origin URLs (same domain)
                    const linkUrl = new URL(absoluteUrl);
                    const baseUrlObj = new URL(baseUrl);
                    
                    if (linkUrl.origin === baseUrlObj.origin && !urls.includes(absoluteUrl)) {
                        urls.push(absoluteUrl);
                    }
                } catch (e) {
                    // Skip invalid URLs silently - we can't use our logger in browser context
                    // Browser-side logs are not helpful for server-side debugging
                }
            });
            
            return urls;
        }, baseUrl);
        
        if (depth <= 0) {
            return []; // No more pages to crawl at depth 0
        }
        
        // Apply crawl strategy
        switch (strategy) {
            case 'dfs':
                // In depth-first, we sort links to prioritize paths with more segments
                return links.sort((a, b) => {
                    const segmentsA = new URL(a).pathname.split('/').filter(Boolean);
                    const segmentsB = new URL(b).pathname.split('/').filter(Boolean);
                    return segmentsB.length - segmentsA.length;
                });
                
            case 'bestFirst':
                // For "best first" strategy, we could implement a heuristic based on URL 
                // or page content relevance, but for now we'll just sort by path length
                return links.sort((a, b) => {
                    const urlA = new URL(a);
                    const urlB = new URL(b);
                    // Simple heuristic: shorter paths might be more important pages
                    return urlA.pathname.length - urlB.pathname.length;
                });
                
            case 'bfs':
            default:
                // Breadth-first strategy - return links as discovered
                return links;
        }
    }

    /**
     * Crawl a single URL and extract content
     */
    private async crawlUrl(
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
    }> {
        const maxDepth = config.depth || 0;
        const maxPages = config.maxPages || 1;
        const waitTime = config.waitTime || 1000;
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
        };
        
        // Stop if we've reached the maximum number of pages
        if (visitedUrls.size >= maxPages) {
            this.logger.info(`Reached maximum number of pages (${maxPages}). Stopping crawl.`);
            return result;
        }
        
        // Avoid crawling the same URL twice
        if (visitedUrls.has(url)) {
            this.logger.info(`Already visited ${url}. Skipping.`);
            return result;
        }
        
        try {
            const browser = await this.getBrowser();
            const page = await browser.newPage();
            
            // Set timeout to avoid hanging on slow pages
            page.setDefaultNavigationTimeout(30000);
            
            // Optional: Track network requests
            if (captureNetworkTraffic) {
                page.on('request', request => {
                    result.networkRequests.push(`${request.method()} ${request.url()}`);
                });
            }
            
            // Navigate to URL
            this.logger.info(`Navigating to ${url} at depth ${currentDepth}`);
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            
            // Wait for the page to load properly
            // Use setTimeout instead of waitForTimeout
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Mark this URL as visited
            visitedUrls.add(url);
            
            // Extract text content
            this.logger.info(`Extracting text from ${url}`);
            const text = await this.extractText(page);
            result.text = text;
            
            // Convert HTML to Markdown
            const html = await page.content();
            result.markdown = this.turndownService.turndown(html);
            
            // Extract tables
            this.logger.info(`Extracting tables from ${url}`);
            result.media.tables = await this.extractTables(page);
            
            // Take screenshot if configured
            if (captureScreenshots) {
                const screenshotPath = await this.takeScreenshot(page, url, visitedUrls.size);
                if (screenshotPath) {
                    result.screenshots.push(screenshotPath);
                }
            }
            
            // If we haven't reached max depth, get links for next pages
            if (currentDepth < maxDepth) {
                const nextUrls = await this.getNextUrls(page, url, maxDepth - currentDepth, config.strategy);
                this.logger.info(`Found ${nextUrls.length} links to crawl at depth ${currentDepth + 1}`);
                
                // Crawl next pages based on strategy
                for (const nextUrl of nextUrls) {
                    // Stop if we've reached max pages
                    if (visitedUrls.size >= maxPages) {
                        break;
                    }
                    
                    // Skip already visited URLs
                    if (visitedUrls.has(nextUrl)) {
                        continue;
                    }
                    
                    // Crawl the next URL
                    const nextResult = await this.crawlUrl(
                        nextUrl, 
                        config, 
                        visitedUrls, 
                        currentDepth + 1
                    );
                    
                    // Append results from the recursive crawl
                    result.text += '\n\n' + nextResult.text;
                    result.markdown += '\n\n## ' + nextUrl + '\n\n' + nextResult.markdown;
                    result.media.tables.push(...nextResult.media.tables);
                    
                    if (captureScreenshots && nextResult.screenshots) {
                        result.screenshots.push(...nextResult.screenshots);
                    }
                }
            }
            
            // Close the page to free up resources
            await page.close();
            result.success = true;
            return result;
            
        } catch (error: any) {
            this.logger.error(`Error while crawling ${url}:`, error);
            return {
                ...result,
                success: false,
                text: `Failed to crawl ${url}: ${error.message}`,
                markdown: `# Error\n\nFailed to crawl ${url}: ${error.message}`,
            };
        }
    }

    /**
     * Close the browser if open (to clean up resources)
     */
    public async closeBrowser(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Public method to initiate a crawl operation
     */
    public async executeCrawl(url: string, options: CrawlParams | CrawlWithMarkdownParams): Promise<CrawlResult> {
        this.logger.info(`Initiating crawl for URL: ${url}`, options);
        
        try {
            // Ensure temp directory exists
            await this.ensureTmpDir();
            
            // Configure and start crawl
            const config: CrawlerConfig = {
                maxPages: options.maxPages || 1,
                depth: options.depth || 0,
                strategy: options.strategy || 'bfs',
                query: 'query' in options ? options.query : undefined,
                waitTime: 'waitTime' in options ? options.waitTime : 1000,
                captureNetworkTraffic: 'captureNetworkTraffic' in options ? options.captureNetworkTraffic : false,
                captureScreenshots: 'captureScreenshots' in options ? options.captureScreenshots : false,
            };
            
            // Execute the crawl
            const crawlResult = await this.crawlUrl(url, config);
            
            // Format the result
            const result: CrawlResult = {
                success: crawlResult.success,
                url,
                text: crawlResult.text,
                markdown: crawlResult.markdown,
                media: { 
                    tables: crawlResult.media.tables 
                }
            };
            
            this.logger.info(`Crawl completed for ${url}. Success: ${result.success}`);
            return result;
            
        } catch (error: any) {
            this.logger.error(`Error during crawl execution for ${url}:`, error);
            
            // Return error response
            return {
                success: false,
                url: url,
                error: error.message || 'An unknown error occurred during crawl execution.',
                traceback: error.stack || 'No traceback available.',
                markdown: `# Error\n\n${error.message || 'An unknown error occurred.'}`,
                text: `Error: ${error.message || 'An unknown error occurred.'}`
            };
        }
    }
}

