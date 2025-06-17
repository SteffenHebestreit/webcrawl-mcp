import { CrawlParams, CrawlResponse } from '../../types/mcp';
import { CrawlResult } from '../../types/crawler';
import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer';
import path from 'path';
import { promises as fs } from 'fs';
import { BaseTool } from './BaseTool';

/**
 * Tool service for basic web crawling
 * Includes all crawler functionality directly in the tool implementation
 */
export class CrawlTool extends BaseTool<CrawlParams, CrawlResponse> {
  private tmpDir: string;

  constructor() {
    super('CrawlTool');
    
    // Define temporary directory for screenshots and other artifacts
    this.tmpDir = path.join(process.cwd(), '.tmp', 'crawl-artifacts');
    
    // Ensure the temporary directory exists
    this.ensureTmpDir().catch(err => this.logger.error('Failed to create temp directory', err));
  }

  /**
   * Ensures the temporary directory exists
   */
  private async ensureTmpDir(): Promise<void> {
    try {
      await fs.mkdir(this.tmpDir, { recursive: true });
    } catch (error) {
      this.logger.error('Error creating temporary directory:', error);
      throw error;
    }
  }

  /**
   * Execute crawl operation
   */  
  public async execute(params: CrawlParams): Promise<CrawlResponse> {
    this.logger.info('Executing crawl with params:', params);
    
    // Create a new abort controller for this execution
    const signal = this.createAbortController();
    const startTime = Date.now();
    
    try {
      const crawlResult = await this.executeCrawl(params.url, params, signal);

      // Check if the operation was aborted
      if (signal.aborted) {
        this.logger.info('Crawl operation was aborted');
        return {
          success: false,
          url: params.url,
          query: params.query,
          text: '',
          error: 'Operation aborted by user'
        };
      }

      if (!crawlResult.success) {
        return {
          success: false,
          url: params.url,
          query: params.query,
          text: '',
          error: crawlResult.error || 'Crawl failed'
        };
      }

      return {
        success: true,
        url: params.url,
        query: params.query,
        text: crawlResult.text || '',
        tables: crawlResult.media?.tables || [],
        images: crawlResult.images || [],
        metadata: crawlResult.metadata,
        links: crawlResult.links || [],
        contentSummary: crawlResult.text?.substring(0, 500) || '',
        relevanceScore: 5,
        pagesVisited: 1,
        totalContentLength: crawlResult.text?.length || 0,
        processingTime: Date.now() - startTime
      };
    } catch (error: any) {
      // Check if the error is due to an abort
      if (error.name === 'AbortError') {
        this.logger.info('Crawl operation was aborted');
        return {
          success: false,
          url: params.url,
          query: params.query,
          text: '',
          error: 'Operation aborted by user'
        };
      }
      
      this.logger.error('Error in CrawlTool execute:', error);
      return {
        success: false,
        url: params.url,
        query: params.query,
        text: '',
        error: error.message
      };
    } finally {
      // Clear the abort controller reference
      this.abortController = null;
    }
  }

  /**
   * Launches a new browser instance for an operation.
   */
  private async launchBrowser(): Promise<Browser> {
    this.logger.info('Launching new browser instance for operation');
    try {
      const launchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-background-networking',
          '--disable-ipc-flooding-protection',
          '--window-size=1280,720',
        ],
        defaultViewport: {
          width: 1280,
          height: 720
        }
      };
      return await puppeteer.launch(launchOptions);
    } catch (error) {
      this.logger.error('Failed to launch browser:', error);
      throw error;
    }
  }

  /**
   * Creates a new page with standard configuration
   */
  private async createStandardPage(browser: Browser): Promise<Page> {
    const page = await browser.newPage();
    
    // Enhanced page configuration for better connection stability
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(60000);
    
    // Set more realistic headers to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
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

    return page;
  }

  /**
   * Navigate to a URL with retry logic
   */
  private async navigateWithRetry(page: Page, url: string, maxAttempts: number = 4): Promise<boolean> {
    let navigationSuccessful = false;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.info(`Attempting to navigate to ${url} (attempt ${attempt}/${maxAttempts})`);
        
        const waitUntilOptions = attempt <= 2 ? 'domcontentloaded' : 'networkidle2';
        const timeout = attempt === 1 ? 60000 : 45000;
        
        const response = await page.goto(url, { 
          waitUntil: waitUntilOptions,
          timeout
        });
        
        if (response && (response.ok() || response.status() === 304)) {
          navigationSuccessful = true;
          this.logger.info(`Successfully navigated to ${url} on attempt ${attempt} (Status: ${response.status()})`);
          break;
        } else if (response) {
          throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
        } else {
          throw new Error('Navigation failed: No response received');
        }
      } catch (error: any) {
        lastError = error;
        this.logger.warn(`Navigation attempt ${attempt} failed for ${url}:`, error.message);
        
        if (attempt < maxAttempts) {
          const waitTime = Math.min(2000 * attempt, 8000);
          this.logger.info(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    if (!navigationSuccessful && lastError) {
      throw new Error(`Navigation failed after ${maxAttempts} attempts: ${lastError.message}`);
    }
    
    return navigationSuccessful;
  }
  /**
   * Execute crawl operation
   */
  private async executeCrawl(url: string, params: CrawlParams, signal?: AbortSignal): Promise<CrawlResult> {
    this.logger.info(`Starting crawl for: ${url}`);
    
    // Check if already aborted before starting
    if (signal?.aborted) {
      this.logger.info('Crawl operation aborted before starting');
      throw new DOMException('Aborted', 'AbortError');
    }
    
    const browser = await this.launchBrowser();
    let page: Page | null = null;

    try {
      // Add an abort handler
      if (signal) {
        signal.addEventListener('abort', async () => {
          this.logger.info('Abort signal received during crawl, cleaning up resources');
          if (page && !page.isClosed()) {
            await page.close().catch(err => this.logger.error('Error closing page on abort:', err));
          }
          if (browser) {
            await browser.close().catch(err => this.logger.error('Error closing browser on abort:', err));
          }
        });
      }
      
      page = await this.createStandardPage(browser);
      
      // Check if aborted before navigation
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      
      // Navigate to the URL
      await this.navigateWithRetry(page, url);
      
      // Check if aborted after navigation
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      
      // Wait for page to stabilize
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, 3000);
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }
      });
      
      // Check if aborted before extraction
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      
      // Extract page data
      const pageData = await page.evaluate(() => {
        const title = document.title;
        const content = document.body?.innerText || '';
        
        // Extract links
        const links: Array<{ url: string; text: string; relevance: number }> = [];
        document.querySelectorAll('a[href]').forEach((anchor) => {
          const element = anchor as HTMLAnchorElement;
          const href = element.href;
          const text = element.textContent?.trim() || '';
          
          if (text && href) {
            links.push({ url: href, text, relevance: 5 });
          }
        });
        
        // Extract images
        const images: Array<{ src: string; alt?: string; title?: string; caption?: string }> = [];
        document.querySelectorAll('img[src]').forEach((img) => {
          const element = img as HTMLImageElement;
          const src = element.src;
          const alt = element.alt;
          const title = element.title;
          
          if (src) {
            images.push({ src, alt, title });
          }
        });
        
        // Extract tables
        const tables: any[] = [];
        document.querySelectorAll('table').forEach((table) => {
          const rows: string[][] = [];
          table.querySelectorAll('tr').forEach((tr) => {
            const cells: string[] = [];
            tr.querySelectorAll('td, th').forEach((cell) => {
              cells.push(cell.textContent?.trim() || '');
            });
            if (cells.length > 0) {
              rows.push(cells);
            }
          });
          if (rows.length > 0) {
            tables.push(rows);
          }
        });
        
        // Extract metadata
        const metadata: Record<string, any> = { title };
        document.querySelectorAll('meta').forEach((meta) => {
          const name = meta.getAttribute('name') || meta.getAttribute('property');
          const content = meta.getAttribute('content');
          
          if (name && content) {
            metadata[name] = content;
          }
        });
        
        return {
          title,
          content,
          links: links.slice(0, 100), // Limit links
          images: images.slice(0, 50), // Limit images
          tables: tables.slice(0, 10), // Limit tables
          metadata
        };
      });
      
      // Final abort check
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      
      this.logger.info(`Successfully crawled ${url}`);
      
      return {
        success: true,
        url,
        text: pageData.content,
        media: { tables: pageData.tables },
        links: pageData.links,
        images: pageData.images,
        metadata: {
          title: pageData.title,
          description: pageData.metadata.description,
          keywords: pageData.metadata.keywords ? pageData.metadata.keywords.split(',').map((k: string) => k.trim()) : undefined,
          language: pageData.metadata.language,
          author: pageData.metadata.author,
          publishDate: pageData.metadata.publishDate
        }
      };
      
    } catch (error: any) {
      // Re-throw AbortError
      if (error.name === 'AbortError') {
        throw error;
      }
      
      this.logger.error(`Error crawling ${url}:`, error);
      
      return {
        success: false,
        url,
        error: error.message
      };
    } finally {
      // Clean up resources if not already closed by abort handler
      if (signal?.aborted) {
        this.logger.info('Skipping resource cleanup as abort handler already handled it');
      } else {
        if (page && !page.isClosed()) {
          await page.close().catch(err => this.logger.error('Error closing page:', err));
        }
        if (browser) {
          await browser.close().catch(err => this.logger.error('Error closing browser:', err));
          this.logger.info(`Browser closed for crawl operation on ${url}`);
        }
      }
    }
  }
}
