import puppeteer, { Browser, Page } from 'puppeteer';
import TurndownService from 'turndown';
import path from 'path';
import { promises as fs } from 'fs';
import { ToolService } from '../@core/services/ToolService.js';
import { ConfigManager } from '../@core/config/configManager.js';
import { createLogger } from '../@core/utils/logger.js';

// Define the structure of parameters for crawl operations
export interface CrawlParams {
  url: string;
  maxPages?: number;
  depth?: number;
  strategy?: 'bfs' | 'dfs' | 'bestFirst';
  captureNetworkTraffic?: boolean;
  captureScreenshots?: boolean;
  waitTime?: number;
}

// Define the structure for crawl with markdown parameters
export interface CrawlWithMarkdownParams extends CrawlParams {
  query?: string;
}

// Define the structure of the crawl response
export interface CrawlResponse {
  success: boolean;
  url: string;
  text: string;
  tables: any[];
  error?: string;
}

// Define the structure of the crawl with markdown response
export interface CrawlWithMarkdownResponse {
  success: boolean;
  url: string;
  markdown: string;
  error?: string;
}

// Service implementation as a class that implements ToolService
export default class CrawlService implements ToolService {
  private name = 'crawl';
  private logger = createLogger('CrawlService');
  private browser: Browser | null = null;
  private tmpDir = path.join(process.cwd(), '.tmp', 'crawl-artifacts');
  private turndownService: TurndownService;
  
  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '_',
      bulletListMarker: '-',
      hr: '---',
      strongDelimiter: '**'
    });
    
    // Configure turndown service with custom rules
    this.configureTurndown();
  }
  
  // Required ToolService interface method
  getName(): string {
    return this.name;
  }
  
  // Required ToolService interface method
  async init(config: ConfigManager): Promise<void> {
    // Configure turndown service
    this.configureTurndown();
    
    // Ensure the temporary directory exists
    try {
      await fs.mkdir(this.tmpDir, { recursive: true });
      this.logger.info(`Temporary directory ensured at: ${this.tmpDir}`);
    } catch (error) {
      this.logger.error('Error creating temporary directory:', error);
      throw new Error(`Failed to create temporary directory: ${error}`);
    }
    
    this.logger.info('CrawlService initialized');
  }
  
  // Required ToolService interface method
  async shutdown(): Promise<void> {
    // Close the browser if it's open
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    
    this.logger.info('CrawlService shutdown completed');
  }
  
  // Configure turndown service with custom rules for markdown conversion
  private configureTurndown() {
    // Preserve table structure
    this.turndownService.addRule('tableRule', {
      filter: ['table'],
      replacement: (content) => {
        return '\n\n' + content + '\n\n';
      }
    });

    // Improve code block handling
    this.turndownService.addRule('codeBlock', {
      filter: ['pre'],
      replacement: (content) => {
        return '\n```\n' + content.trim() + '\n```\n';
      }
    });
  }

  // Initialize and return browser instance
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.logger.info('Launching new browser instance');
      
      const launchOptions = {
        headless: true,
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

  // Extracts tables from the page
  private async extractTables(page: Page): Promise<any[]> {
    const tables = await page.evaluate(() => {
      const tablesData: any[] = [];
      const tables = document.querySelectorAll('table');
      
      tables.forEach((table) => {
        const tableData: any = {
          rows: [],
          caption: table.querySelector('caption')?.textContent || null,
        };
        
        const rows = table.querySelectorAll('tr');
        rows.forEach((row) => {
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

  // Takes a screenshot of the current page
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

  // Extract text content from the page
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

  // Get the URLs for the next pages to crawl based on the current page and crawl strategy
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
          // Skip invalid URLs silently
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
        // For "best first" strategy, prioritize by path length
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

  // Crawl a single URL and extract content
  private async crawlUrl(
    url: string,
    params: CrawlParams,
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
    const maxDepth = params.depth || 0;
    const maxPages = params.maxPages || 1;
    const waitTime = params.waitTime || 1000;
    const captureScreenshots = params.captureScreenshots || false;
    const captureNetworkTraffic = params.captureNetworkTraffic || false;
    const strategy = params.strategy || 'bfs';
    
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
        const nextUrls = await this.getNextUrls(page, url, maxDepth - currentDepth, strategy);
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
            params, 
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

  // Public methods for MCP service calls

  // Execute the basic crawl operation - main method called through the MCP protocol
  async executeCrawl(params: CrawlParams): Promise<CrawlResponse> {
    this.logger.info('Executing crawl with params:', params);
    try {
      // Configure and start crawl
      const crawlParams = {
        url: params.url,
        maxPages: params.maxPages || 10, // Default max pages
        depth: params.depth || 3, // Default depth
        strategy: params.strategy || 'bfs', // Default strategy
        waitTime: params.waitTime || 1000, // Default wait time
        captureNetworkTraffic: params.captureNetworkTraffic || false,
        captureScreenshots: params.captureScreenshots || false,
      };
      
      const result = await this.crawlUrl(params.url, crawlParams);

      return {
        success: result.success,
        url: params.url,
        text: result.text || (result.success ? 'No text content extracted.' : 'Error occurred during crawl.'),
        tables: result.media.tables || [],
        error: result.success ? undefined : 'Failed to crawl the URL'
      };
    } catch (error: any) {
      this.logger.error('Error in CrawlService executeCrawl:', error);
      return {
        success: false,
        url: params.url,
        text: `Failed to execute crawl: ${error.message}`,
        tables: [],
        error: error.message
      };
    }
  }

  // Execute the crawl with markdown operation
  async executeCrawlWithMarkdown(params: CrawlWithMarkdownParams): Promise<CrawlWithMarkdownResponse> {
    this.logger.info('Executing crawlWithMarkdown with params:', params);
    try {
      // Configure and start crawl
      const crawlParams = {
        url: params.url,
        maxPages: params.maxPages || 10, // Default max pages
        depth: params.depth || 3, // Default depth
        strategy: params.strategy || 'bfs', // Default strategy
        waitTime: 1000, // Default wait time
        query: params.query,
      };
      
      const result = await this.crawlUrl(params.url, crawlParams);

      return {
        success: result.success,
        url: params.url,
        markdown: result.markdown || (result.success ? 'No markdown content generated.' : `# Error\n\n${result.text}`),
        error: result.success ? undefined : 'Failed to generate markdown content'
      };
    } catch (error: any) {
      this.logger.error('Error in CrawlService executeCrawlWithMarkdown:', error);
      return {
        success: false,
        url: params.url,
        markdown: `# Error\n\nFailed to execute markdown crawl: ${error.message}`,
        error: error.message
      };
    }
  }
}