import { Browser, Page } from 'puppeteer';
import { BaseCrawler } from './BaseCrawler';
import { createLogger } from '../../utils/logger';

/**
 * Crawler specialized in extracting internal links from a webpage
 */
export class LinkCrawler extends BaseCrawler {
    protected override logger = createLogger('LinkCrawler');

    constructor() {
        super();
    }

    /**
     * Extract all internal links from a page without following external links
     */
    public async extractInternalLinks(
        url: string,
        includeFragments: boolean = true,
        includeQueryParams: boolean = true,
        categorizeLinks: boolean = true,
        maxLinks: number = 100
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
        }>;
        pageTitle?: string;
        baseUrl: string;
        error?: string;
    }> {
        this.logger.info(`Extracting internal links from: ${url}`);
        const browser = await this.launchBrowser();
        let page: Page | null = null;
        
        try {
            page = await this.createStandardPage(browser);
            
            // Enable request interception to handle failed requests
            await page.setRequestInterception(true);
            
            page.on('request', (request) => {
                // Allow all requests but add some resilience
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
            
            // Navigate to URL with enhanced retry logic
            await this.navigateWithRetry(page, url);
            
            // Wait for the page to stabilize
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Extract links and page metadata
            const extractedData = await page.evaluate((includeFragments, includeQueryParams, categorizeLinks) => {
                const baseUrl = window.location.origin;
                const pageTitle = document.title;
                const links: Array<{
                    url: string;
                    text: string;
                    title?: string;
                    type: "navigation" | "content" | "media" | "form" | "other";
                    depth: number;
                    section?: string;
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
                        
                        // Only include internal links (same origin)
                        if (linkUrl.origin === currentUrl.origin) {
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
                                    section
                                });
                            }
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
            }, includeFragments, includeQueryParams, categorizeLinks);
            
            // Close the page
            await page.close();
            
            // Remove duplicates and limit results
            const uniqueLinks = extractedData.links.filter((link, index, self) => 
                index === self.findIndex(l => l.url === link.url)
            ).slice(0, maxLinks);
            
            this.logger.info(`Extracted ${uniqueLinks.length} internal links from ${url}`);
            
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
                this.logger.info(`Browser closed for extractInternalLinks operation on ${url}`);
            }
        }
    }
}
