import { Browser, Page } from 'puppeteer';
import { BaseCrawler } from './BaseCrawler';
import { createLogger } from '../../utils/logger';
import { SitemapGeneratorResponse } from '../../types/mcp';

/**
 * Crawler specialized in generating sitemaps
 */
export class SitemapCrawler extends BaseCrawler {
    protected override logger = createLogger('SitemapCrawler');

    constructor() {
        super();
    }

    /**
     * Generate a comprehensive sitemap by crawling a website
     * @param url The URL to generate sitemap for
     * @param depth The depth of crawling (default: 2)
     * @param maxPages Maximum number of pages to include (default: 50)
     * @param includeExternalLinks Whether to include external links (default: false)
     * @param respectRobotsTxt Whether to respect robots.txt (default: true)
     * @param followRedirects Whether to follow redirects (default: true)
     * @param excludePatterns URL patterns to exclude (default: [])
     * @param includeMetadata Whether to include page metadata (default: true)
     * @returns A SitemapGeneratorResponse with sitemap data
     */
    public async generateSitemap(
        url: string,
        depth: number = 2,
        maxPages: number = 50,
        includeExternalLinks: boolean = false,
        respectRobotsTxt: boolean = true,
        followRedirects: boolean = true,
        excludePatterns: string[] = [],
        includeMetadata: boolean = true
    ): Promise<SitemapGeneratorResponse> {
        this.logger.info(`Generating sitemap for: ${url}`);
        const browser = await this.launchBrowser();
        let page: Page | null = null;
        const startTime = Date.now();
        
        try {
            await this.ensureTmpDir();
            const baseUrl = new URL(url);
            const visitedUrls = new Set<string>();
            const urlQueue: Array<{ url: string; depth: number; parentUrl?: string }> = [{ url, depth: 0 }];
            const sitemapEntries: Array<{
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
            let maxDepthReached = 0;
            let pagesProcessed = 0;
            let successfulPages = 0;
            let errorPages = 0;
            let externalLinks = 0;

            while (urlQueue.length > 0 && pagesProcessed < maxPages) {
                const currentItem = urlQueue.shift();
                if (!currentItem) continue;
                const { url: currentUrl, depth: currentDepth, parentUrl } = currentItem;

                if (visitedUrls.has(currentUrl)) continue;
                visitedUrls.add(currentUrl);
                pagesProcessed++;
                maxDepthReached = Math.max(maxDepthReached, currentDepth);

                // Track parent-child relationships for hierarchy
                if (parentUrl) {
                    if (!hierarchy[parentUrl]) {
                        hierarchy[parentUrl] = [];
                    }
                    hierarchy[parentUrl].push(currentUrl);
                }

                // Basic exclusion check
                if (excludePatterns.some(pattern => currentUrl.includes(pattern))) {
                    sitemapEntries.push({ 
                        url: currentUrl, 
                        status: 'excluded', 
                        depth: currentDepth,
                        parentUrl 
                    });
                    continue;
                }

                // External link check
                const currentUrlObj = new URL(currentUrl);
                if (currentUrlObj.hostname !== baseUrl.hostname) {
                    if (!includeExternalLinks) {
                        sitemapEntries.push({ 
                            url: currentUrl, 
                            status: 'external', 
                            depth: currentDepth,
                            parentUrl 
                        });
                        externalLinks++;
                        continue;
                    }
                }
                
                page = await browser.newPage();
                try {
                    // Configure page settings
                    if (!followRedirects) {
                        await page.setRequestInterception(true);
                        page.on('request', request => {
                            if (request.isNavigationRequest() && request.redirectChain().length > 0) {
                                request.abort();
                            } else {
                                request.continue();
                            }
                        });
                    }

                    // Navigate to the page
                    this.logger.info(`Navigating to ${currentUrl} (depth ${currentDepth})`);
                    const response = await page.goto(currentUrl, { 
                        waitUntil: 'domcontentloaded', 
                        timeout: 30000 
                    });
                    
                    const contentType = response?.headers()['content-type'] || '';
                    const lastModified = response?.headers()['last-modified'] || '';
                    
                    // Extract page metadata
                    const pageData = await page.evaluate(() => {
                        const getMetaContent = (name: string) => {
                            const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
                            return meta ? meta.getAttribute('content') : null;
                        };
                        
                        const text = document.body.innerText || '';
                        const h1Elements = Array.from(document.querySelectorAll('h1')).map(el => el.textContent?.trim()).filter(Boolean) as string[];
                        const h2Elements = Array.from(document.querySelectorAll('h2')).map(el => el.textContent?.trim()).filter(Boolean) as string[];
                        const h3Elements = Array.from(document.querySelectorAll('h3')).map(el => el.textContent?.trim()).filter(Boolean) as string[];
                        
                        return {
                            title: document.title,
                            description: getMetaContent('description') || '',
                            wordCount: text.split(/\s+/).filter(Boolean).length,
                            headings: {
                                h1: h1Elements,
                                h2: h2Elements,
                                h3: h3Elements
                            }
                        };
                    });

                    // Add to sitemap
                    sitemapEntries.push({
                        url: currentUrl,
                        title: pageData.title,
                        description: pageData.description,
                        depth: currentDepth,
                        parentUrl,
                        status: 'crawled',
                        lastModified,
                        contentType,
                        wordCount: pageData.wordCount,
                        headings: includeMetadata ? pageData.headings : undefined
                    });
                    
                    successfulPages++;

                    // Extract links for the next level if we haven't reached max depth
                    if (currentDepth < depth) {
                        const links = await page.evaluate(() => 
                            Array.from(document.querySelectorAll('a[href]'))
                                .map(a => (a as HTMLAnchorElement).href)
                        );
                        
                        for (const link of links) {
                            try {
                                const absoluteLink = new URL(link, currentUrl).toString();
                                if (!visitedUrls.has(absoluteLink) && 
                                    !urlQueue.some(item => item.url === absoluteLink) && 
                                    urlQueue.length + visitedUrls.size < maxPages) {
                                    urlQueue.push({ 
                                        url: absoluteLink, 
                                        depth: currentDepth + 1, 
                                        parentUrl: currentUrl 
                                    });
                                }
                            } catch (e) {
                                // Ignore invalid URLs
                            }
                        }
                    }
                } catch (navError: any) {
                    this.logger.warn(`Failed to process ${currentUrl}: ${navError.message}`);
                    sitemapEntries.push({ 
                        url: currentUrl, 
                        status: 'error', 
                        depth: currentDepth, 
                        parentUrl,
                        error: navError.message 
                    });
                    errorPages++;
                } finally {
                    if (page && !page.isClosed()) {
                        await page.close();
                        page = null;
                    }
                }
            }
            
            const crawlDuration = Date.now() - startTime;
            this.logger.info(`Sitemap generation completed for ${url}. Found ${sitemapEntries.length} pages.`);
            
            // Construct the SitemapGeneratorResponse according to the interface
            return {
                success: true,
                url: url,
                sitemap: sitemapEntries,
                statistics: {
                    totalPages: pagesProcessed,
                    successfulPages,
                    errorPages,
                    externalLinks,
                    maxDepthReached,
                    crawlDuration
                },
                hierarchy,
                baseUrl: baseUrl.toString(),
                crawlTimestamp: new Date().toISOString()
            };
        } catch (error: any) {
            this.logger.error(`Sitemap generation failed for ${url}:`, error);
            return { 
                success: false, 
                url: url, 
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
                baseUrl: url,
                crawlTimestamp: new Date().toISOString(),
                error: error.message
            };
        } finally {
            if (page && !page.isClosed()) {
                await page.close();
            }
            if (browser) {
                await browser.close();
                this.logger.info(`Browser closed for generateSitemap operation on ${url}`);
            }
        }
    }
}
