import { SmartCrawlParams, SmartCrawlResponse } from '../../types/mcp';
import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer';
import path from 'path';
import { promises as fs } from 'fs';
import { BaseTool } from './BaseTool';

/**
 * Tool service for intelligent crawling with relevance scoring
 */
export class SmartCrawlTool extends BaseTool<SmartCrawlParams, SmartCrawlResponse> {
  private tmpDir: string;

  constructor() {
    super('SmartCrawlTool');
    
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
   * Execute smart crawl with relevance scoring
   */
  public async execute(params: SmartCrawlParams): Promise<SmartCrawlResponse> {
    this.logger.info('Executing smartCrawl with params:', params);
    
    // Create a new abort controller for this execution
    const signal = this.createAbortController();
    const startTime = Date.now();
    
    try {
      const crawlResult = await this.executeSmartCrawl(params, signal);
      
      // Check if the operation was aborted
      if (signal.aborted) {
        this.logger.info('Smart crawl operation was aborted');
        return {
          success: false,
          url: params.url,
          query: params.query,
          relevantPages: [],
          overallSummary: 'Operation aborted by user',
          error: 'Operation aborted by user',
          processingTime: Date.now() - startTime
        };
      }
      
      if (!crawlResult.success) {
        return {
          success: false,
          url: params.url,
          query: params.query,
          relevantPages: [],
          overallSummary: 'Smart crawl failed',
          error: crawlResult.error || 'Smart crawl failed',
          processingTime: Date.now() - startTime
        };
      }

      // Add processing time to the result
      crawlResult.processingTime = Date.now() - startTime;
      return crawlResult;
    } catch (error: any) {
      // Check if the error is due to an abort
      if (error.name === 'AbortError') {
        this.logger.info('Smart crawl operation was aborted');
        return {
          success: false,
          url: params.url,
          query: params.query,
          relevantPages: [],
          overallSummary: 'Operation aborted by user',
          error: 'Operation aborted by user',
          processingTime: Date.now() - startTime
        };
      }
      
      this.logger.error('Error in SmartCrawlTool execute:', error);
      return {
        success: false,
        url: params.url,
        query: params.query,
        relevantPages: [],
        overallSummary: 'Error occurred during smart crawl',
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }
  /**
   * Launches a new browser instance for an operation.
   */
  private async launchBrowser(signal?: AbortSignal): Promise<Browser> {
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
      
      // Check if operation was aborted before launching browser
      if (signal?.aborted) {
        throw new Error('Operation aborted before browser launch');
      }
      
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
   * Calculate relevance score for content based on query
   */
  private calculateRelevanceScore(content: string, query: string): number {
    if (!query || !content) return 0;
    
    const queryTerms = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    
    let score = 0;
    queryTerms.forEach(term => {
      // Count occurrences of each term
      const matches = (contentLower.match(new RegExp(term, 'g')) || []).length;
      score += matches;
    });
    
    // Normalize score by content length
    return Math.min(score / Math.max(content.length / 1000, 1), 10);
  }

  /**
     /**
   * Execute smart crawl with relevance scoring
   */
  private async executeSmartCrawl(params: SmartCrawlParams, signal: AbortSignal): Promise<SmartCrawlResponse> {
    this.logger.info(`Starting smart crawl for: ${params.url} with query: ${params.query}`);
    
    const maxPages = params.maxPages || 5;
    const depth = params.depth || 2;
    const relevanceThreshold = params.relevanceThreshold || 2;
      const visitedUrls = new Set<string>();
    const pagesToVisit: Array<{ url: string; depth: number }> = [{ url: params.url, depth: 0 }];
    const results: Array<{
      url: string;
      title: string;
      content: string;
      relevanceScore: number;
      links: Array<{ url: string; text: string; title?: string }>;
      depth: number;
    }> = [];
    
    let browser: Browser | null = null;
    
    try {
      // Launch browser with abort signal
      browser = await this.launchBrowser(signal);
      
      while (pagesToVisit.length > 0 && results.length < maxPages) {
        // Check if operation was aborted
        if (signal.aborted) {
          this.logger.info('Smart crawl operation aborted during execution');
          throw new Error('AbortError');
        }
        
        const { url, depth: currentDepth } = pagesToVisit.shift()!;
        
        if (visitedUrls.has(url) || currentDepth > depth) {
          continue;
        }
        
        visitedUrls.add(url);
        
        try {
          const page = await this.createStandardPage(browser);
          
          // Navigate to the URL with abort handling
          await Promise.race([
            this.navigateWithRetry(page, url),
            new Promise((_, reject) => {
              const onAbort = () => {
                page.close().catch(err => this.logger.error('Error closing page after abort:', err));
                reject(new Error('AbortError'));
              };
              
              if (signal.aborted) {
                onAbort();
              } else {
                signal.addEventListener('abort', onAbort, { once: true });
              }
            })
          ]);
          
          // Wait for page to stabilize with abort handling
          await Promise.race([
            new Promise(resolve => setTimeout(resolve, 2000)),
            new Promise((_, reject) => {
              const onAbort = () => reject(new Error('AbortError'));
              signal.addEventListener('abort', onAbort, { once: true });
            })
          ]);
          
          // Extract page data
          const pageData = await page.evaluate(() => {
            const title = document.title;
            const content = document.body?.innerText || '';
            
            // Extract links
            const links: Array<{ url: string; text: string; title?: string }> = [];
            document.querySelectorAll('a[href]').forEach((anchor) => {
              const element = anchor as HTMLAnchorElement;
              const href = element.href;
              const text = element.textContent?.trim() || '';
              const title = element.title;
              
              if (text && href) {
                links.push({ url: href, text, title });
              }
            });
            
            return { title, content, links };
          });
          
          // Calculate relevance score
          const relevanceScore = this.calculateRelevanceScore(pageData.content, params.query);
          
          // Add to results if relevant enough
          if (relevanceScore >= relevanceThreshold) {
            results.push({
              url,
              title: pageData.title,
              content: pageData.content.substring(0, 2000), // Limit content length
              relevanceScore,
              links: pageData.links.slice(0, 20), // Limit links
              depth: currentDepth
            });
          }
          
          // Add new pages to visit (only internal links)
          if (currentDepth < depth) {
            pageData.links.forEach(link => {
              try {
                const linkUrl = new URL(link.url);
                const baseUrl = new URL(params.url);
                
                // Only add internal links
                if (linkUrl.origin === baseUrl.origin && !visitedUrls.has(link.url)) {
                  pagesToVisit.push({ url: link.url, depth: currentDepth + 1 });
                }
              } catch (e) {
                // Skip invalid URLs
              }
            });
          }
          
          await page.close();
          
        } catch (error: any) {
          this.logger.warn(`Failed to crawl ${url}:`, error.message);
        }
      }
        // Sort results by relevance score
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      // Convert results to SmartCrawlResponse format
      const relevantPages = results.map(page => ({
        url: page.url,
        title: page.title,
        summary: page.content.substring(0, 300) + (page.content.length > 300 ? '...' : ''),
        relevanceScore: page.relevanceScore,
        keyFindings: page.content.split('\n').filter(line => line.trim().length > 50).slice(0, 3)
      }));
      
      const overallSummary = results.length > 0 
        ? `Found ${results.length} relevant pages out of ${visitedUrls.size} visited. Average relevance score: ${(results.reduce((sum, page) => sum + page.relevanceScore, 0) / results.length).toFixed(2)}`
        : `No relevant pages found out of ${visitedUrls.size} visited pages.`;
      
      this.logger.info(`Smart crawl completed. Found ${results.length} relevant pages out of ${visitedUrls.size} visited`);
      
      return {
        success: true,
        url: params.url,
        query: params.query,
        relevantPages,
        overallSummary
      };
      
    } catch (error: any) {
      this.logger.error(`Error in smart crawl:`, error);
      
      return {
        success: false,
        url: params.url,
        query: params.query,
        relevantPages: [],
        overallSummary: 'Smart crawl failed due to error',
        error: error.message
      };
    } finally {
      if (browser) {
        await browser.close();
        this.logger.info(`Browser closed for smart crawl operation`);
      }
    }
  }
}