import { SearchInPageParams, SearchInPageResponse } from '../../types/mcp';
import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer';
import path from 'path';
import { promises as fs } from 'fs';
import { BaseTool } from './BaseTool';

/**
 * Tool service for searching within web pages
 * Includes all crawler functionality directly in the tool implementation
 */
export class SearchInPageTool extends BaseTool<SearchInPageParams, SearchInPageResponse> {
  private tmpDir: string;

  constructor() {
    super('SearchInPageTool');
    
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
   * Execute search in page
   */
  public async execute(params: SearchInPageParams): Promise<SearchInPageResponse> {
    this.logger.info('Executing searchInPage with params:', params);
    
    try {
      const searchResult = await this.searchInPage(params);      if (!searchResult.success) {
        return {
          success: false,
          url: params.url,
          query: params.query,
          matches: [],
          totalMatches: 0,
          summary: '',
          error: searchResult.error || 'Search in page failed'
        };
      }

      return searchResult;    } catch (error: any) {
      this.logger.error('Error in SearchInPageTool execute:', error);
      return {
        success: false,
        url: params.url,
        query: params.query,
        matches: [],
        totalMatches: 0,
        summary: '',
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
   * Search for content within a page
   */
  private searchInContent(content: string, query: string): {
    matches: Array<{ snippet: string; position: number; relevance: number }>;
    summary: string;
  } {
    const matches: Array<{ snippet: string; position: number; relevance: number }> = [];
    
    if (!content || !query) {
      return { matches, summary: 'No content or query provided' };
    }
    
    const queryTerms = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    
    // Find all matches for each query term
    queryTerms.forEach(term => {
      let index = 0;
      while ((index = contentLower.indexOf(term, index)) !== -1) {
        // Extract snippet around the match
        const start = Math.max(0, index - 100);
        const end = Math.min(content.length, index + term.length + 100);
        const snippet = content.substring(start, end);
        
        // Calculate relevance score
        const relevance = this.calculateRelevanceScore(snippet, query);
        
        matches.push({
          snippet: snippet.trim(),
          position: index,
          relevance
        });
        
        index += term.length;
      }
    });
    
    // Remove duplicates and sort by relevance
    const uniqueMatches = matches
      .filter((match, index, self) => 
        index === self.findIndex(m => Math.abs(m.position - match.position) < 50)
      )
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10); // Limit to top 10 matches
    
    // Generate summary
    const totalMatches = matches.length;
    const summary = totalMatches > 0 
      ? `Found ${totalMatches} matches for "${query}". ${uniqueMatches[0]?.snippet.substring(0, 200)}...`
      : `No matches found for "${query}"`;
    
    return { matches: uniqueMatches, summary };
  }

  /**
   * Calculate relevance score for a snippet
   */
  private calculateRelevanceScore(snippet: string, query: string): number {
    if (!query || !snippet) return 0;
    
    const queryTerms = query.toLowerCase().split(/\s+/);
    const snippetLower = snippet.toLowerCase();
    
    let score = 0;
    queryTerms.forEach(term => {
      // Count occurrences of each term
      const matches = (snippetLower.match(new RegExp(term, 'g')) || []).length;
      score += matches;
    });
    
    // Normalize score by snippet length
    return Math.min(score / Math.max(snippet.length / 100, 1), 10);
  }

  /**
   * Search within a web page
   */
  private async searchInPage(params: SearchInPageParams): Promise<SearchInPageResponse> {
    this.logger.info(`Starting search in page: ${params.url} for query: ${params.query}`);
    
    const browser = await this.launchBrowser();
    let page: Page | null = null;
    
    try {
      page = await this.createStandardPage(browser);
      
      // Navigate to the URL
      await this.navigateWithRetry(page, params.url);
      
      // Wait for page to stabilize
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Extract page content
      const pageData = await page.evaluate(() => {
        const title = document.title;
        const content = document.body?.innerText || '';
        
        return { title, content };
      });
      
      // Search within the content
      const searchResults = this.searchInContent(pageData.content, params.query);
      
      this.logger.info(`Search completed. Found ${searchResults.matches.length} relevant matches`);
      
      return {
        success: true,
        url: params.url,
        query: params.query,
        matches: searchResults.matches,        totalMatches: searchResults.matches.length,
        summary: searchResults.summary
      };
      
    } catch (error: any) {
      this.logger.error(`Error searching in page ${params.url}:`, error);
        return {
        success: false,
        url: params.url,
        query: params.query,
        matches: [],
        totalMatches: 0,
        summary: '',
        error: error.message
      };
    } finally {
      if (page && !page.isClosed()) {
        await page.close();
      }
      if (browser) {
        await browser.close();
        this.logger.info(`Browser closed for search in page operation`);
      }
    }
  }
}
