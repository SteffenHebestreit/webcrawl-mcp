import puppeteer, { Browser, Page } from 'puppeteer';
import { createLogger } from '../../utils/logger';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * Configuration for dynamic content loading
 */
export interface DynamicContentConfig {
    /** Maximum time to wait for dynamic content (ms) */
    maxWaitTime?: number;
    /** Check for DOM mutations */
    detectDomMutations?: boolean;
    /** Wait for specific selectors to appear */
    waitForSelectors?: string[];
    /** Wait for JavaScript frameworks to load */
    detectJsFrameworks?: boolean;
    /** Wait for network requests to stabilize */
    waitForNetworkIdle?: boolean;
    /** Custom content detection function */
    customContentCheck?: string;
    /** Enable simple navigation fallback when dynamic detection fails (default: true) */
    enableSimpleFallback?: boolean;
    /** Timeout for simple fallback navigation in ms (default: 30000) */
    simpleFallbackTimeout?: number;
}

/**
 * Base crawler class with common functionality for all crawlers
 */
export abstract class BaseCrawler {
    protected tmpDir: string;
    protected logger = createLogger('BaseCrawler');

    constructor() {
        // Define temporary directory for screenshots and other artifacts
        this.tmpDir = path.join(process.cwd(), '.tmp', 'crawl-artifacts');
        
        // Ensure the temporary directory exists
        this.ensureTmpDir().catch(err => this.logger.error('Failed to create temp directory', err));
    }

    /**
     * Ensures the temporary directory exists
     */
    protected async ensureTmpDir(): Promise<void> {
        try {
            await fs.mkdir(this.tmpDir, { recursive: true });
        } catch (error) {
            this.logger.error('Error creating temporary directory:', error);
            throw error;
        }
    }

    /**
     * Launches a new browser instance for an operation.
     */
    protected async launchBrowser(): Promise<Browser> {
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
    }    /**
     * Creates a new page with standard configuration
     */    protected async createStandardPage(browser: Browser): Promise<Page> {
        const page = await browser.newPage();
        
        // Enhanced page configuration for better connection stability with extended timeouts for long-running operations
        await page.setDefaultNavigationTimeout(600000); // 10 minutes for very long crawl operations
        await page.setDefaultTimeout(600000); // 10 minutes to match HTTP timeout configuration
        
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
    protected async navigateWithRetry(page: Page, url: string, maxAttempts: number = 4): Promise<boolean> {
        let navigationSuccessful = false;
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                this.logger.info(`Attempting to navigate to ${url} (attempt ${attempt}/${maxAttempts})`);                  // Try different wait strategies with extended timeouts for long-running crawl operations
                const waitUntilOptions = attempt <= 2 ? 'domcontentloaded' : 'networkidle2';
                const timeout = attempt === 1 ? 600000 : 480000; // 10 minutes first attempt, 8 minutes subsequent attempts
                
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
                    // Progressive backoff: wait longer between retries
                    const waitTime = Math.min(2000 * attempt, 8000);
                    this.logger.info(`Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }
        
        if (!navigationSuccessful && lastError) {
            throw lastError;
        }
        
        return navigationSuccessful;
    }

    /**
     * Enhanced navigation with dynamic content detection
     */
    protected async navigateWithDynamicContent(
        page: Page, 
        url: string, 
        dynamicConfig: DynamicContentConfig = {},
        maxAttempts: number = 4
    ): Promise<boolean> {
        let navigationSuccessful = false;
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                this.logger.info(`Attempting to navigate to ${url} with dynamic content detection (attempt ${attempt}/${maxAttempts})`);
                  // Initial navigation with basic wait - extended timeouts for long-running operations
                const waitUntilOptions = attempt <= 2 ? 'domcontentloaded' : 'networkidle2';
                const timeout = attempt === 1 ? 600000 : 300000; // 10 minutes first attempt, 5 minutes subsequent attempts
                
                const response = await page.goto(url, { 
                    waitUntil: waitUntilOptions,
                    timeout
                });
                
                if (response && (response.ok() || response.status() === 304)) {
                    this.logger.info(`Initial navigation successful for ${url} (Status: ${response.status()})`);
                    
                    // Now wait for dynamic content to load
                    await this.waitForDynamicContent(page, dynamicConfig);
                    
                    navigationSuccessful = true;
                    this.logger.info(`Dynamic content loading completed for ${url} on attempt ${attempt}`);
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
            // Check if simple fallback is enabled (default: true)
            const enableFallback = dynamicConfig.enableSimpleFallback !== false;
            const fallbackTimeout = dynamicConfig.simpleFallbackTimeout || 30000;
            
            if (enableFallback) {
                this.logger.warn(`All dynamic content detection attempts failed for ${url}. Attempting simple navigation fallback...`);
                
                // Try simple navigation as fallback (similar to SitemapCrawler approach)
                navigationSuccessful = await this.navigateWithSimpleFallback(page, url, fallbackTimeout);
                
                if (!navigationSuccessful) {
                    this.logger.error(`Both dynamic content detection and simple fallback failed for ${url}`);
                    throw lastError;
                } else {
                    this.logger.info(`Simple navigation fallback succeeded for ${url}`);
                }
            } else {
                this.logger.error(`Dynamic content detection failed for ${url} and fallback is disabled`);
                throw lastError;
            }
        }
        
        return navigationSuccessful;
    }

    /**
     * Simple navigation fallback method similar to SitemapCrawler approach
     * This is used when dynamic content detection fails
     */
    protected async navigateWithSimpleFallback(
        page: Page, 
        url: string, 
        timeout: number = 30000
    ): Promise<boolean> {
        try {
            this.logger.info(`Attempting simple navigation fallback to ${url} with ${timeout}ms timeout`);
            
            const response = await page.goto(url, { 
                waitUntil: 'domcontentloaded', 
                timeout 
            });
            
            if (response && (response.ok() || response.status() === 304)) {
                this.logger.info(`Simple navigation fallback successful for ${url} (Status: ${response.status()})`);
                return true;
            } else if (response) {
                throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
            } else {
                throw new Error('Navigation failed: No response received');
            }
        } catch (error: any) {
            this.logger.warn(`Simple navigation fallback failed for ${url}:`, error.message);
            return false;
        }
    }

    /**
     * Wait for dynamic content to load using multiple detection strategies
     */
    protected async waitForDynamicContent(page: Page, config: DynamicContentConfig): Promise<void> {
        const maxWaitTime = config.maxWaitTime || 15000;
        const startTime = Date.now();
        
        this.logger.info('Starting dynamic content detection...');
        
        try {
            // Strategy 1: Wait for specific selectors if provided
            if (config.waitForSelectors && config.waitForSelectors.length > 0) {
                await this.waitForSelectors(page, config.waitForSelectors, maxWaitTime);
            }
            
            // Strategy 2: Detect JavaScript frameworks
            if (config.detectJsFrameworks !== false) {
                await this.waitForJavaScriptFrameworks(page, maxWaitTime);
            }
            
            // Strategy 3: Monitor DOM mutations
            if (config.detectDomMutations !== false) {
                await this.waitForDomStability(page, maxWaitTime);
            }
            
            // Strategy 4: Wait for network idle with custom logic
            if (config.waitForNetworkIdle !== false) {
                await this.waitForNetworkStability(page, maxWaitTime);
            }
            
            // Strategy 5: Custom content check
            if (config.customContentCheck) {
                await this.waitForCustomContentCheck(page, config.customContentCheck, maxWaitTime);
            }
            
            const elapsedTime = Date.now() - startTime;
            this.logger.info(`Dynamic content detection completed in ${elapsedTime}ms`);
            
        } catch (error: any) {
            const elapsedTime = Date.now() - startTime;
            this.logger.warn(`Dynamic content detection timed out after ${elapsedTime}ms:`, error.message);
            // Don't throw error, continue with whatever content is available
        }
    }

    /**
     * Wait for specific CSS selectors to appear in the DOM
     */
    private async waitForSelectors(page: Page, selectors: string[], maxWaitTime: number): Promise<void> {
        const timeout = Math.min(maxWaitTime, 10000);
        
        for (const selector of selectors) {
            try {
                this.logger.debug(`Waiting for selector: ${selector}`);
                await page.waitForSelector(selector, { timeout });
                this.logger.debug(`Selector found: ${selector}`);
            } catch (error) {
                this.logger.debug(`Selector not found within timeout: ${selector}`);
                // Continue with other selectors
            }
        }
    }

    /**
     * Detect and wait for common JavaScript frameworks to finish loading
     */
    private async waitForJavaScriptFrameworks(page: Page, maxWaitTime: number): Promise<void> {
        const startTime = Date.now();
        const checkInterval = 500;
        
        while (Date.now() - startTime < maxWaitTime) {
            try {
                const frameworksReady = await page.evaluate(() => {
                    // Check for React
                    if (typeof window !== 'undefined' && (window as any).React) {
                        // Look for React render completion indicators
                        const reactRoots = document.querySelectorAll('[data-reactroot], #root, .react-root');
                        if (reactRoots.length === 0) return false;
                    }
                    
                    // Check for Vue.js
                    if (typeof window !== 'undefined' && (window as any).Vue) {
                        // Look for Vue app indicators
                        const vueApps = document.querySelectorAll('[data-server-rendered], .vue-app, #app');
                        if (vueApps.length === 0) return false;
                    }
                    
                    // Check for Angular
                    if (typeof window !== 'undefined' && (window as any).ng) {
                        // Look for Angular app indicators
                        const ngApps = document.querySelectorAll('[ng-app], [data-ng-app], .ng-scope');
                        if (ngApps.length === 0) return false;
                    }
                    
                    // Check for jQuery and wait for $(document).ready()
                    if (typeof window !== 'undefined' && (window as any).jQuery) {
                        return (window as any).jQuery.isReady;
                    }
                    
                    // Check for loading indicators
                    const loadingIndicators = document.querySelectorAll(
                        '.loading, .spinner, .loader, [class*="loading"], [class*="spinner"]'
                    );
                    if (loadingIndicators.length > 0) {
                        // Check if any loading indicators are still visible
                        for (const indicator of loadingIndicators) {
                            const style = window.getComputedStyle(indicator as Element);
                            if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                                return false;
                            }
                        }
                    }
                    
                    return true;
                });
                
                if (frameworksReady) {
                    this.logger.debug('JavaScript frameworks appear to be ready');
                    break;
                }
                
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            } catch (error) {
                this.logger.debug('Error checking JavaScript frameworks:', error);
                break;
            }
        }
    }

    /**
     * Wait for DOM mutations to stabilize (no significant changes for a period)
     */
    private async waitForDomStability(page: Page, maxWaitTime: number): Promise<void> {
        const stabilityPeriod = 2000; // Wait for 2 seconds of stability
        const maxMutations = 5; // Allow up to 5 mutations during stability period
        
        await page.evaluate((stabilityPeriod: number, maxMutations: number) => {
            return new Promise<void>((resolve) => {
                let mutationCount = 0;
                let stabilityTimeout: NodeJS.Timeout;
                
                const observer = new MutationObserver((mutations) => {
                    // Filter out insignificant mutations
                    const significantMutations = mutations.filter(mutation => {
                        // Ignore mutations to script, style, or meta tags
                        if (mutation.target.nodeName === 'SCRIPT' || 
                            mutation.target.nodeName === 'STYLE' || 
                            mutation.target.nodeName === 'META') {
                            return false;
                        }
                        
                        // Ignore attribute changes to data- attributes
                        if (mutation.type === 'attributes' && 
                            mutation.attributeName?.startsWith('data-')) {
                            return false;
                        }
                        
                        return true;
                    });
                    
                    if (significantMutations.length > 0) {
                        mutationCount += significantMutations.length;
                        
                        // Reset stability timer
                        if (stabilityTimeout) {
                            clearTimeout(stabilityTimeout);
                        }
                        
                        stabilityTimeout = setTimeout(() => {
                            observer.disconnect();
                            resolve();
                        }, stabilityPeriod);
                    }
                });
                
                // Start observing
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeOldValue: false,
                    characterData: true
                });
                
                // Initial stability timer
                stabilityTimeout = setTimeout(() => {
                    observer.disconnect();
                    resolve();
                }, stabilityPeriod);
            });
        }, stabilityPeriod, maxMutations);
        
        this.logger.debug('DOM appears to be stable');
    }

    /**
     * Wait for network requests to stabilize
     */
    private async waitForNetworkStability(page: Page, maxWaitTime: number): Promise<void> {
        const stabilityPeriod = 1500; // Wait for 1.5 seconds of network quiet
        let requestCount = 0;
        let lastRequestTime = Date.now();
        
        const requestHandler = () => {
            requestCount++;
            lastRequestTime = Date.now();
        };
        
        const responseHandler = () => {
            lastRequestTime = Date.now();
        };
        
        page.on('request', requestHandler);
        page.on('response', responseHandler);
        
        try {
            const startTime = Date.now();
            
            while (Date.now() - startTime < maxWaitTime) {
                const timeSinceLastRequest = Date.now() - lastRequestTime;
                
                if (timeSinceLastRequest >= stabilityPeriod) {
                    this.logger.debug(`Network stable for ${timeSinceLastRequest}ms`);
                    break;
                }
                
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } finally {
            page.off('request', requestHandler);
            page.off('response', responseHandler);
        }
    }

    /**
     * Wait for a custom content check function to return true
     */
    private async waitForCustomContentCheck(page: Page, checkFunction: string, maxWaitTime: number): Promise<void> {
        const startTime = Date.now();
        const checkInterval = 1000;
        
        while (Date.now() - startTime < maxWaitTime) {
            try {
                const result = await page.evaluate((fn) => {
                    try {
                        // Safely evaluate the custom function
                        return eval(`(${fn})()`);
                    } catch (e) {
                        return false;
                    }
                }, checkFunction);
                
                if (result) {
                    this.logger.debug('Custom content check passed');
                    break;
                }
                
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            } catch (error) {
                this.logger.debug('Error in custom content check:', error);
                break;
            }
        }
    }

    /**
     * Extract text content from the page
     */
    protected async extractText(page: Page): Promise<string> {
        return page.evaluate(() => {
            // Get the body text
            return document.body.innerText || '';
        });
    }

    /**
     * Takes a screenshot of the current page
     */
    protected async takeScreenshot(page: Page, url: string, index: number = 0): Promise<string> {
        await this.ensureTmpDir();
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const urlPath = new URL(url).hostname.replace(/[^a-z0-9]/gi, '-');
        const filename = `${urlPath}-${timestamp}-${index}.png`;
        const filePath = path.join(this.tmpDir, filename);
        
        await page.screenshot({ path: filePath as `${string}.png`, fullPage: true });
        return filePath;
    }

    /**
     * Search within crawled content using simple text matching
     */
    public searchInContent(content: string, query: string): {
        matches: Array<{snippet: string; position: number; relevance: number}>;
        summary: string;
    } {
        const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const contentLower = content.toLowerCase();
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
        
        const matches: Array<{snippet: string; position: number; relevance: number}> = [];
        
        sentences.forEach((sentence, index) => {
            const sentenceLower = sentence.toLowerCase();
            let relevance = 0;
            
            // Check for direct matches of the query
            if (sentenceLower.includes(query.toLowerCase())) {
                relevance += 3;
            }
            
            // Check for individual word matches
            queryWords.forEach(word => {
                if (sentenceLower.includes(word)) {
                    relevance += 1;
                    
                    // Bonus for exact word match (not substring)
                    const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
                    if (wordRegex.test(sentenceLower)) {
                        relevance += 0.5;
                    }
                }
            });
            
            if (relevance > 0) {
                // Add surrounding context for better understanding
                const position = contentLower.indexOf(sentenceLower);
                const startPos = Math.max(0, position - 50);
                const endPos = Math.min(content.length, position + sentence.length + 50);
                const snippet = content.substring(startPos, endPos).trim();
                
                matches.push({
                    snippet,
                    position,
                    relevance
                });
            }
        });
        
        // Sort by relevance and take top matches
        matches.sort((a, b) => b.relevance - a.relevance);
        const topMatches = matches.slice(0, 10);
        
        // Generate summary from top matches
        const summary = topMatches.slice(0, 3)
            .map(m => m.snippet)
            .join(' ... ');
        
        return { matches: topMatches, summary };
    }

    /**
     * Calculate relevance score for a link based on its text and context
     */
    protected calculateLinkRelevance(linkText: string, pageContent: string): number {
        // Base score starts at 1
        let score = 1;
        
        // No text, no relevance
        if (!linkText || linkText.trim().length === 0) {
            return 0;
        }
        
        // Longer link text often indicates more information
        if (linkText.length > 20) {
            score += 1;
        }
        
        // Check if link text appears frequently in page
        const linkTextLower = linkText.toLowerCase();
        const contentLower = pageContent.toLowerCase();
        const occurrences = contentLower.split(linkTextLower).length - 1;
        
        if (occurrences > 3) {
            score += 1;
        }
        
        // Links that suggest important content
        const importantKeywords = ['guide', 'tutorial', 'how to', 'learn', 'documentation', 
                                 'reference', 'example', 'article', 'overview', 'introduction'];
                                 
        for (const keyword of importantKeywords) {
            if (linkTextLower.includes(keyword)) {
                score += 0.5;
                break;
            }
        }
        
        // Penalize common navigation links that are less likely to contain primary content
        const navKeywords = ['home', 'contact', 'about', 'login', 'register', 'sign up', 'sign in', 
                           'privacy', 'terms', 'help', 'faq', 'support', 'next page', 'previous'];
                           
        for (const keyword of navKeywords) {
            if (linkTextLower === keyword || linkTextLower === keyword + ' us') {
                score -= 0.5;
                break;
            }
        }
        
        // Ensure final score is within bounds
        return Math.min(score, 5);
    }
}
