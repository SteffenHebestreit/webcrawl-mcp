import { ExtractLinksParams, ExtractLinksResponse } from '../../types/mcp';
import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer';
import path from 'path';
import { promises as fs } from 'fs';
import { BaseTool } from './BaseTool';

/**
 * Tool service for extracting links from web pages
 * Includes all crawler functionality directly in the tool implementation
 */
export class ExtractLinksTool extends BaseTool<ExtractLinksParams, ExtractLinksResponse> {
  private tmpDir: string;

  constructor() {
    super('ExtractLinksTool');
    
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
  }  /**
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
   * Extract links from a web page
   */  private async extractLinks(
    url: string,
    includeFragments: boolean = true,
    includeQueryParams: boolean = true,
    categorizeLinks: boolean = true,
    includeExternalLinks: boolean = true,
    maxLinks: number = 100,
    signal?: AbortSignal
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
      isExternal: boolean;
    }>;
    pageTitle?: string;
    baseUrl: string;
  error?: string;
  }> {
    this.logger.info(`Extracting links from: ${url}`);
    let browser: Browser | null = null;
    let page: Page | null = null;
    
    try {
      // Check if operation was aborted before starting
      if (signal?.aborted) {
        this.logger.info('Extract links operation aborted before browser launch');
        throw new Error('AbortError');
      }
      
      browser = await this.launchBrowser(signal);
      page = await this.createStandardPage(browser);
      
      // Enable request interception to handle failed requests
      await page.setRequestInterception(true);
      
      page.on('request', (request) => {
        // Check if operation was aborted before continuing request
        if (signal?.aborted) {
          request.abort();
          return;
        }
        
        const resourceType = request.resourceType();
        
        // Skip images and fonts for faster loading and better stability
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
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
      });
      
      // Setup abort signal listener
      if (signal) {
        signal.addEventListener('abort', () => {
          this.logger.info('Extract links operation aborted during execution');
          if (page) {
            page.close().catch(err => this.logger.error('Error closing page after abort:', err));
          }
        });
      }
        // Navigate to URL with enhanced retry logic and abort handling
      await Promise.race([
        this.navigateWithRetry(page, url),
        new Promise((_, reject) => {
          if (signal?.aborted) {
            reject(new Error('AbortError'));
          } else if (signal) {
            const abortHandler = () => reject(new Error('AbortError'));
            signal.addEventListener('abort', abortHandler, { once: true });
          }
        })
      ]);
      
      // Wait for the page to stabilize with abort handling
      await Promise.race([
        new Promise(resolve => setTimeout(resolve, 3000)),
        new Promise((_, reject) => {
          if (signal?.aborted) {
            reject(new Error('AbortError'));
          } else if (signal) {
            const abortHandler = () => reject(new Error('AbortError'));
            signal.addEventListener('abort', abortHandler, { once: true });
          }
        })
      ]);
      
      // Extract links and page metadata
      const extractedData = await page.evaluate((includeFragments, includeQueryParams, categorizeLinks, includeExternalLinks) => {
        const baseUrl = window.location.origin;
        const pageTitle = document.title;
        const links: Array<{
          url: string;
          text: string;
          title?: string;
          type: "navigation" | "content" | "media" | "form" | "other";
          depth: number;
          section?: string;
          isExternal: boolean;
        }> = [];

        // Function to categorize links based on context and attributes
        function categorizeLink(element: HTMLAnchorElement, text: string): "navigation" | "content" | "media" | "form" | "other" {
          if (!categorizeLinks) return "content";
          
          // Check for navigation indicators
          const navKeywords = ['nav', 'menu', 'header', 'footer', 'sidebar', 'breadcrumb'];
          const parentClasses = element.closest('[class*="nav"], [class*="menu"], nav, header, footer')?.className || '';
          const elementClasses = element.className;
          
          if (navKeywords.some(keyword => 
            parentClasses.toLowerCase().includes(keyword) || 
            elementClasses.toLowerCase().includes(keyword)
          )) {
            return "navigation";
          }
          
          // Check for media links
          const href = element.href.toLowerCase();
          if (href.includes('download') || 
            /\.(pdf|doc|docx|xls|xlsx|zip|rar|mp4|mp3|avi|mov|jpg|jpeg|png|gif)(\?|$)/.test(href)) {
            return "media";
          }
          
          // Check for form-related links
          if (element.closest('form') || 
            href.includes('login') || 
            href.includes('register') || 
            href.includes('contact') ||
            href.includes('subscribe')) {
            return "form";
          }
          
          // Check for content links (articles, posts, etc.)
          const contentKeywords = ['article', 'post', 'blog', 'news', 'content'];
          const contentParent = element.closest('article, main, [class*="content"], [class*="post"], [class*="article"]');
          
          if (contentParent || contentKeywords.some(keyword => 
            parentClasses.toLowerCase().includes(keyword) || 
            elementClasses.toLowerCase().includes(keyword) ||
            text.toLowerCase().includes(keyword)
          )) {
            return "content";
          }
          
          return "other";
        }
        
        // Function to get section name where link is located
        function getLinkSection(element: HTMLAnchorElement): string | undefined {
          const section = element.closest('section, article, header, footer, nav, main, aside');
          if (section) {
            return section.tagName.toLowerCase() + 
                   (section.id ? `#${section.id}` : '') +
                   (section.className ? `.${section.className.split(' ')[0]}` : '');
          }
          return undefined;
        }
        
        // Extract all anchor elements
        const anchorElements = document.querySelectorAll('a[href]');
        
        anchorElements.forEach((anchor) => {
          const element = anchor as HTMLAnchorElement;
          const href = element.href;
          const text = element.textContent?.trim() || element.getAttribute('aria-label') || href;
          const title = element.title;
          
          try {
            const linkUrl = new URL(href);
            const currentUrl = new URL(window.location.href);
            
            // Determine if link is internal or external
            const isExternal = linkUrl.origin !== currentUrl.origin;
            
            // Skip external links if includeExternalLinks is false
            if (isExternal && !includeExternalLinks) {
              return;
            }
            
            let finalUrl = href;
            
            // Handle fragment and query parameter options
            if (!includeFragments && linkUrl.hash) {
              // Remove hash fragment
              linkUrl.hash = '';
              finalUrl = linkUrl.toString();
            }
            
            if (!includeQueryParams && linkUrl.search) {
              // Remove query parameters
              linkUrl.search = '';
              finalUrl = linkUrl.toString();
            }
            
            // Calculate URL depth (number of path segments)
            const pathSegments = linkUrl.pathname.split('/').filter(segment => segment.length > 0);
            const depth = pathSegments.length;
            
            // Categorize the link
            const type = categorizeLink(element, text);
            
            // Get section information
            const section = getLinkSection(element);
            
            // Add to links array if text is meaningful
            if (text && text.length > 0 && text !== href) {
              links.push({
                url: finalUrl,
                text,
                title,
                type,
                depth,
                section,
                isExternal
              });
            }
          } catch (e) {
            // Skip invalid URLs
          }
        });
        
        return {
          links,
          pageTitle,
          baseUrl
        };
      }, includeFragments, includeQueryParams, categorizeLinks, includeExternalLinks);
      
      // Close the page
      await page.close();
      
      // Remove duplicates and limit results
      const uniqueLinks = extractedData.links.filter((link, index, self) => 
        index === self.findIndex(l => l.url === link.url)
      ).slice(0, maxLinks);
      
      this.logger.info(`Extracted ${uniqueLinks.length} links (${uniqueLinks.filter(l => !l.isExternal).length} internal, ${uniqueLinks.filter(l => l.isExternal).length} external) from ${url}`);
      
      return {
        success: true,
        url,
        links: uniqueLinks,
        pageTitle: extractedData.pageTitle,
        baseUrl: extractedData.baseUrl
      };
    } catch (error: any) {
      this.logger.error(`Error extracting links from ${url}:`, error);
      
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
      }
      
      return {
        success: false,
        url,
        links: [],
        baseUrl: url,
        error: errorMessage
      };
    } finally {
      if (page && !page.isClosed()) {
        await page.close();
      }
      if (browser) {
        await browser.close();
        this.logger.info(`Browser closed for extractLinks operation on ${url}`);
      }
    }
  }
  /**
   * Execute link extraction from a specific page
   */
  public async execute(params: ExtractLinksParams): Promise<ExtractLinksResponse> {
    this.logger.info('Executing extractLinks with params:', params);
    
    // Create a new abort controller for this execution
    const signal = this.createAbortController();
    const startTime = Date.now();
    
    try {
      const extractedLinks = await this.extractLinks(
        params.url,
        params.includeFragments ?? true,
        params.includeQueryParams ?? true,
        params.categorizeLinks ?? true,
        params.includeExternalLinks ?? true,
        params.maxLinks ?? 100,
        signal
      );
      
      // Check if the operation was aborted
      if (signal.aborted) {
        this.logger.info('Extract links operation was aborted');
        return {
          success: false,
          url: params.url,
          links: [],
          totalLinks: 0,
          internalLinks: 0,
          externalLinks: 0,
          baseUrl: params.url,
          error: 'Operation aborted by user',
          processingTime: Date.now() - startTime
        };
      }

      if (!extractedLinks.success) {
        return {
          success: false,
          url: params.url,
          links: [],
          totalLinks: 0,
          internalLinks: 0,
          externalLinks: 0,
          baseUrl: params.url,
          error: extractedLinks.error || 'Failed to extract links',
          processingTime: Date.now() - startTime
        };
      }

      let sortedLinks = extractedLinks.links;
      switch (params.sortBy) {
        case 'url':
          sortedLinks = sortedLinks.sort((a, b) => a.url.localeCompare(b.url));
          break;
        case 'text':
          sortedLinks = sortedLinks.sort((a, b) => a.text.localeCompare(b.text));
          break;
        case 'relevance':
        default:
          const typePriority = { navigation: 1, content: 2, media: 3, form: 4, other: 5 };
          sortedLinks = sortedLinks.sort((a, b) => {
            // First sort by internal/external
            if (a.isExternal !== b.isExternal) {
              return a.isExternal ? 1 : -1; // Internal links first
            }
            // Then by type
            const typeDiff = typePriority[a.type] - typePriority[b.type];
            if (typeDiff !== 0) return typeDiff;
            // Then by text length
            return b.text.length - a.text.length;
          });
          break;
      }

      // Count links by type
      const linksByType = params.categorizeLinks ? {
        navigation: sortedLinks.filter(l => l.type === 'navigation').length,
        content: sortedLinks.filter(l => l.type === 'content').length,
        media: sortedLinks.filter(l => l.type === 'media').length,
        form: sortedLinks.filter(l => l.type === 'form').length,
        other: sortedLinks.filter(l => l.type === 'other').length
      } : undefined;

      // Count internal and external links
      const internalLinks = sortedLinks.filter(l => !l.isExternal).length;
      const externalLinks = sortedLinks.filter(l => l.isExternal).length;      return {
        success: true,
        url: params.url,
        links: sortedLinks,
        linksByType,
        totalLinks: sortedLinks.length,
        internalLinks,
        externalLinks,
        pageTitle: extractedLinks.pageTitle,
        baseUrl: extractedLinks.baseUrl,
        error: undefined,
        processingTime: Date.now() - startTime
      };
    } catch (error: any) {
      // Check if the error is due to an abort
      if (error.name === 'AbortError' || error.message === 'AbortError') {
        this.logger.info('Extract links operation was aborted');
        return {
          success: false,
          url: params.url,
          links: [],
          totalLinks: 0,
          internalLinks: 0,
          externalLinks: 0,
          baseUrl: params.url,
          error: 'Operation aborted by user',
          processingTime: Date.now() - startTime
        };
      }
      
      this.logger.error('Error in ExtractLinksTool executeExtractLinks:', error);
      return {
        success: false,
        url: params.url,
        links: [],
        totalLinks: 0,
        internalLinks: 0,
        externalLinks: 0,
        baseUrl: params.url,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }
}
