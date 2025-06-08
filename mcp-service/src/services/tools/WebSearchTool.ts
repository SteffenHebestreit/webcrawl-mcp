import { WebSearchParams, WebSearchResponse } from '../../types/mcp';
import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer';
import path from 'path';
import { promises as fs } from 'fs';
import { BaseTool } from './BaseTool';

/**
 * Tool service for web search functionality
 * Includes all crawler functionality directly in the tool implementation
 */
export class WebSearchTool extends BaseTool<WebSearchParams, WebSearchResponse> {
  private tmpDir: string;

  constructor() {
    super('WebSearchTool');
    
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
   * Execute web search
   */
  public async execute(params: WebSearchParams): Promise<WebSearchResponse> {    this.logger.info('Executing webSearch with params:', params);
    
    try {
      const searchResult = await this.performWebSearch(params);

      if (!searchResult.success) {
        return {
          success: false,
          query: params.query,
          engine: params.engine || 'duckduckgo',
          results: [],
          totalResults: 0,
          searchTimeMs: 0,
          error: searchResult.error || 'Web search failed'
        };
      }

      return searchResult;
    } catch (error: any) {
      this.logger.error('Error in WebSearchTool execute:', error);
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
   * Perform web search using DuckDuckGo
   */
  private async searchDuckDuckGo(page: Page, query: string, maxResults: number): Promise<Array<{
    title: string;
    url: string;
    snippet: string;
    position: number;
  }>> {
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    
    await this.navigateWithRetry(page, searchUrl);
    
    // Wait for search results to load
    await page.waitForSelector('[data-testid="result"]', { timeout: 10000 });
    
    // Extract search results
    const results = await page.evaluate((maxResults) => {
      const resultElements = document.querySelectorAll('[data-testid="result"]');
      const results: Array<{
        title: string;
        url: string;
        snippet: string;
        position: number;
      }> = [];
      
      resultElements.forEach((element, index) => {
        if (index >= maxResults) return;
        
        const titleElement = element.querySelector('h2 a') as HTMLAnchorElement;
        const snippetElement = element.querySelector('[data-result="snippet"]') as HTMLElement;
        
        if (titleElement && snippetElement) {
          results.push({
            title: titleElement.textContent?.trim() || '',
            url: titleElement.href || '',
            snippet: snippetElement.textContent?.trim() || '',
            position: index + 1
          });
        }
      });
      
      return results;
    }, maxResults);
    
    return results;
  }

  /**
   * Perform web search using Bing
   */
  private async searchBing(page: Page, query: string, maxResults: number): Promise<Array<{
    title: string;
    url: string;
    snippet: string;
    position: number;
  }>> {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    
    await this.navigateWithRetry(page, searchUrl);
    
    // Wait for search results to load
    await page.waitForSelector('.b_results .b_algo', { timeout: 10000 });
    
    // Extract search results
    const results = await page.evaluate((maxResults) => {
      const resultElements = document.querySelectorAll('.b_results .b_algo');
      const results: Array<{
        title: string;
        url: string;
        snippet: string;
        position: number;
      }> = [];
      
      resultElements.forEach((element, index) => {
        if (index >= maxResults) return;
        
        const titleElement = element.querySelector('h2 a') as HTMLAnchorElement;
        const snippetElement = element.querySelector('.b_caption p') as HTMLElement;
        
        if (titleElement && snippetElement) {
          results.push({
            title: titleElement.textContent?.trim() || '',
            url: titleElement.href || '',
            snippet: snippetElement.textContent?.trim() || '',
            position: index + 1
          });
        }
      });
      
      return results;
    }, maxResults);
    
    return results;
  }
  /**
   * Perform web search using Google
   */
  private async searchGoogle(page: Page, query: string, maxResults: number): Promise<Array<{
    title: string;
    url: string;
    snippet: string;
    position: number;
  }>> {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    
    await this.navigateWithRetry(page, searchUrl);
    
    // Wait for search results to load
    await page.waitForSelector('.g', { timeout: 10000 });
    
    // Extract search results
    const results = await page.evaluate((maxResults) => {
      const resultElements = document.querySelectorAll('.g');
      const results: Array<{
        title: string;
        url: string;
        snippet: string;
        position: number;
      }> = [];
      
      resultElements.forEach((element, index) => {
        if (index >= maxResults) return;
        
        const titleElement = element.querySelector('h3') as HTMLElement;
        const linkElement = element.querySelector('a') as HTMLAnchorElement;
        const snippetElement = element.querySelector('.VwiC3b, .s3v9rd') as HTMLElement;
        
        if (titleElement && linkElement && snippetElement) {
          results.push({
            title: titleElement.textContent?.trim() || '',
            url: linkElement.href || '',
            snippet: snippetElement.textContent?.trim() || '',
            position: index + 1
          });
        }
      });
      
      return results;
    }, maxResults);
    
    return results;
  }

  /**
   * Perform web search using SearXNG
   */
  private async searchSearxng(page: Page, query: string, maxResults: number): Promise<Array<{
    title: string;
    url: string;
    snippet: string;
    position: number;
  }>> {
    // Using a public SearXNG instance
    const searchUrl = `https://searx.org/search?q=${encodeURIComponent(query)}&format=json`;
    
    // For SearXNG, we'll use a direct API approach instead of scraping
    try {
      const response = await page.evaluate(async (url, maxResults) => {
        const resp = await fetch(url);
        const data = await resp.json();
        
        const results: Array<{
          title: string;
          url: string;
          snippet: string;
          position: number;
        }> = [];
        
        if (data.results) {
          data.results.slice(0, maxResults).forEach((result: any, index: number) => {
            results.push({
              title: result.title || '',
              url: result.url || '',
              snippet: result.content || '',
              position: index + 1
            });
          });
        }
        
        return results;
      }, searchUrl, maxResults);
      
      return response;
    } catch (error) {
      this.logger.warn('SearXNG API search failed, falling back to DuckDuckGo');
      return await this.searchDuckDuckGo(page, query, maxResults);
    }
  }

  /**
   * Perform web search
   */
  private async performWebSearch(params: WebSearchParams): Promise<WebSearchResponse> {
    this.logger.info(`Starting web search for: ${params.query} using ${params.engine || 'duckduckgo'}`);
    
    const startTime = Date.now();
    const browser = await this.launchBrowser();
    let page: Page | null = null;
    
    try {
      page = await this.createStandardPage(browser);
      
      const maxResults = params.numResults || 10;
      let results: Array<{
        title: string;
        url: string;
        snippet: string;
        position: number;
      }> = [];
        // Perform search based on selected engine
      switch (params.engine) {
        case 'google':
          results = await this.searchGoogle(page, params.query, maxResults);
          break;
        case 'searxng':
          results = await this.searchSearxng(page, params.query, maxResults);
          break;
        case 'duckduckgo':
        default:
          results = await this.searchDuckDuckGo(page, params.query, maxResults);
          break;
      }
      
      const searchTime = Date.now() - startTime;
      this.logger.info(`Web search completed. Found ${results.length} results in ${searchTime}ms`);
      
      return {
        success: true,
        query: params.query,
        engine: params.engine || 'duckduckgo',
        results,
        totalResults: results.length,
        searchTimeMs: searchTime
      };
      
    } catch (error: any) {
      this.logger.error(`Error performing web search:`, error);
      
      return {
        success: false,
        query: params.query,
        engine: params.engine || 'duckduckgo',
        results: [],
        totalResults: 0,
        searchTimeMs: Date.now() - startTime,
        error: error.message
      };
    } finally {
      if (page && !page.isClosed()) {
        await page.close();
      }
      if (browser) {
        await browser.close();
        this.logger.info(`Browser closed for web search operation`);
      }
    }
  }
}
