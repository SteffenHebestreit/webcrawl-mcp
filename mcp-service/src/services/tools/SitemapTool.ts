import { SitemapGeneratorParams, SitemapGeneratorResponse } from '../../types/mcp';
import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer';
import path from 'path';
import { promises as fs } from 'fs';
import { BaseTool } from './BaseTool';

/**
 * Tool service for generating sitemaps
 * Includes all crawler functionality directly in the tool implementation
 */
export class SitemapTool extends BaseTool<SitemapGeneratorParams, SitemapGeneratorResponse> {
  private tmpDir: string;

  constructor() {
    super('SitemapTool');
    
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
   * Execute sitemap generation
   */
  public async execute(params: SitemapGeneratorParams): Promise<SitemapGeneratorResponse> {
    this.logger.info('Executing sitemap generation with params:', params);
    
    try {
      const sitemapResult = await this.generateSitemap(params);

      if (!sitemapResult.success) {
        return {
          success: false,
          url: params.url,
          sitemap: [],
          statistics: {
            totalPages: 0,
            successfulPages: 0,
            errorPages: 0,
            externalLinks: 0,
            maxDepthReached: 0,
            crawlDuration: 0
          },
          hierarchy: {},
          baseUrl: params.url,
          crawlTimestamp: new Date().toISOString(),
          error: sitemapResult.error || 'Sitemap generation failed'
        };
      }

      return sitemapResult;
    } catch (error: any) {
      this.logger.error('Error in SitemapTool execute:', error);
      return {
        success: false,
        url: params.url,
        sitemap: [],
        statistics: {
          totalPages: 0,
          successfulPages: 0,
          errorPages: 0,
          externalLinks: 0,
          maxDepthReached: 0,
          crawlDuration: 0
        },
        hierarchy: {},
        baseUrl: params.url,
        crawlTimestamp: new Date().toISOString(),
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
   * Generate sitemap for a website
   */
  private async generateSitemap(params: SitemapGeneratorParams): Promise<SitemapGeneratorResponse> {
    this.logger.info(`Starting sitemap generation for: ${params.url}`);
    
    const startTime = Date.now();
    const maxDepth = params.depth || 3;
    const maxUrls = params.maxPages || 100;
    const includeExternal = params.includeExternalLinks || false;
    
    const visitedUrls = new Set<string>();
    const urlsToVisit: Array<{ url: string; depth: number; parentUrl?: string }> = [{ url: params.url, depth: 0 }];
    const sitemap: Array<{
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
    }> = [];
    const hierarchy: { [url: string]: string[] } = {};
    let successfulPages = 0;
    let errorPages = 0;
    let externalLinks = 0;
    let maxDepthReached = 0;
    
    const browser = await this.launchBrowser();
    
    try {
      const baseUrl = new URL(params.url);
      
      while (urlsToVisit.length > 0 && sitemap.length < maxUrls) {
        const { url, depth, parentUrl } = urlsToVisit.shift()!;
        
        if (visitedUrls.has(url) || depth > maxDepth) {
          continue;
        }
        
        visitedUrls.add(url);
        maxDepthReached = Math.max(maxDepthReached, depth);
        
        try {
          const page = await this.createStandardPage(browser);
          
          // Navigate to the URL
          await this.navigateWithRetry(page, url);
          
          // Wait for page to stabilize
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Extract page data
          const pageData = await page.evaluate(() => {
            const title = document.title;
            const description = (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content;
            const contentType = document.contentType;
            const content = document.body?.innerText || '';
            
            // Extract headings
            const h1Elements = Array.from(document.querySelectorAll('h1')).map(h => h.textContent?.trim()).filter(Boolean);
            const h2Elements = Array.from(document.querySelectorAll('h2')).map(h => h.textContent?.trim()).filter(Boolean);
            const h3Elements = Array.from(document.querySelectorAll('h3')).map(h => h.textContent?.trim()).filter(Boolean);
            
            // Extract links
            const links: string[] = [];
            document.querySelectorAll('a[href]').forEach((anchor) => {
              const element = anchor as HTMLAnchorElement;
              const href = element.href;
              if (href) {
                links.push(href);
              }
            });
            
            return {
              title,
              description,
              contentType,
              content,
              wordCount: content.split(/\s+/).length,
              headings: {
                h1: h1Elements.length > 0 ? h1Elements as string[] : undefined,
                h2: h2Elements.length > 0 ? h2Elements as string[] : undefined,
                h3: h3Elements.length > 0 ? h3Elements as string[] : undefined
              },
              links
            };
          });
          
          // Add to sitemap
          sitemap.push({
            url,
            title: pageData.title,
            description: pageData.description,
            depth,
            parentUrl,
            status: "crawled",
            lastModified: new Date().toISOString(),
            contentType: pageData.contentType,
            wordCount: pageData.wordCount,
            headings: pageData.headings
          });
          
          successfulPages++;
          
          // Add child URLs to hierarchy
          if (!hierarchy[url]) {
            hierarchy[url] = [];
          }
          
          // Add new URLs to visit
          if (depth < maxDepth) {
            pageData.links.forEach(link => {
              try {
                const linkUrl = new URL(link);
                
                // Check if internal or external
                if (linkUrl.origin === baseUrl.origin) {
                  if (!visitedUrls.has(link)) {
                    urlsToVisit.push({ url: link, depth: depth + 1, parentUrl: url });
                    hierarchy[url].push(link);
                  }
                } else if (includeExternal) {
                  externalLinks++;
                  sitemap.push({
                    url: link,
                    depth: depth + 1,
                    parentUrl: url,
                    status: "external"
                  });
                }
              } catch (e) {
                // Skip invalid URLs
              }
            });
          }
          
          await page.close();
          
        } catch (error: any) {
          this.logger.warn(`Failed to process ${url}:`, error.message);
          errorPages++;
          
          sitemap.push({
            url,
            depth,
            parentUrl,
            status: "error",
            error: error.message
          });
        }
      }
      
      const crawlDuration = Date.now() - startTime;
      
      this.logger.info(`Sitemap generation completed. Generated ${sitemap.length} entries`);
      
      return {
        success: true,
        url: params.url,
        sitemap,
        statistics: {
          totalPages: visitedUrls.size,
          successfulPages,
          errorPages,
          externalLinks,
          maxDepthReached,
          crawlDuration
        },
        hierarchy,
        baseUrl: baseUrl.origin,
        crawlTimestamp: new Date().toISOString()
      };
      
    } catch (error: any) {
      this.logger.error(`Error in sitemap generation:`, error);
      
      return {
        success: false,
        url: params.url,
        sitemap: [],
        statistics: {
          totalPages: 0,
          successfulPages: 0,
          errorPages: 0,
          externalLinks: 0,
          maxDepthReached: 0,
          crawlDuration: Date.now() - startTime
        },
        hierarchy: {},
        baseUrl: params.url,
        crawlTimestamp: new Date().toISOString(),
        error: error.message
      };
    } finally {
      if (browser) {
        await browser.close();
        this.logger.info(`Browser closed for sitemap generation`);
      }
    }
  }
}