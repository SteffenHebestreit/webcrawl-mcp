import axios from 'axios';
import { JSDOM } from 'jsdom';
import { createLogger } from '../../utils/logger';
import { BaseCrawler } from './BaseCrawler';
import { WebSearchResult } from '../../types/crawler';

/**
 * WebSearchCrawler handles web search operations using various search engines
 * without requiring API keys by parsing HTML responses.
 */
export class WebSearchCrawler extends BaseCrawler {
    protected override logger = createLogger('WebSearchCrawler');
    
    /**
     * Execute a web search query using the specified search engine
     * @param query The search query
     * @param engine The search engine to use (google, duckduckgo, searxng)
     * @param numResults Maximum number of results to return
     * @param safeSearch Whether to enable safe search filtering
     * @param timeRange Optional time range filter (day, week, month, year)
     * @returns Search results with title, URL, and snippet
     */
    public async executeWebSearch(
        query: string,
        engine: 'google' | 'duckduckgo' | 'searxng' = 'searxng',
        numResults: number = 10,
        safeSearch: boolean = true,
        timeRange?: 'day' | 'week' | 'month' | 'year'
    ): Promise<WebSearchResult> {
        this.logger.info(`Executing web search for query "${query}" using ${engine}`);
        
        try {
            switch (engine) {
                case 'google':
                    return await this.searchWithGoogle(query, numResults, safeSearch, timeRange);
                case 'duckduckgo':
                    return await this.searchWithDuckDuckGo(query, numResults, safeSearch, timeRange);
                case 'searxng':
                    return await this.searchWithSearXNG(query, numResults, safeSearch, timeRange);
                default:
                    throw new Error(`Unsupported search engine: ${engine}`);
            }
        } catch (error: any) {
            this.logger.error(`Error executing web search: ${error.message}`);
            return {
                success: false,
                engine,
                query,
                results: [],
                error: error.message,
                timeMs: 0
            };
        }
    }

    /**
     * Search using DuckDuckGo
     */
    private async searchWithDuckDuckGo(
        query: string,
        numResults: number,
        safeSearch: boolean,
        timeRange?: 'day' | 'week' | 'month' | 'year'
    ): Promise<WebSearchResult> {
        const startTime = Date.now();
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
        
        try {
            // DuckDuckGo search parameters
            let url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            if (!safeSearch) url += '&kp=-2';
            
            // Add time range if specified
            if (timeRange) {
                const timeParam = timeRange === 'day' ? 'd' : 
                                timeRange === 'week' ? 'w' : 
                                timeRange === 'month' ? 'm' : 'y';
                url += `&df=${timeParam}`;
            }

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'text/html',
                }
            });

            const dom = new JSDOM(response.data);
            const document = dom.window.document;
              // Extract search results
            const resultElements = document.querySelectorAll('.result');
            const results: Array<{
                title: string;
                url: string;
                snippet: string;
                position: number;
            }> = Array.from(resultElements).slice(0, numResults).map(result => {
                const titleElement = result.querySelector('.result__title a');
                const snippetElement = result.querySelector('.result__snippet');
                
                const title = titleElement?.textContent?.trim() || '';
                // Get the href and remove tracking parameters
                const href = titleElement?.getAttribute('href') || '';
                const url = this.extractUrlFromDDGHref(href);
                const snippet = snippetElement?.textContent?.trim() || '';
                
                return {
                    title,
                    url,
                    snippet,
                    position: 0, // Will be set below
                };
            });
            
            // Set position for each result
            results.forEach((result, index) => {
                result.position = index + 1;
            });

            return {
                success: true,
                engine: 'duckduckgo',
                query,
                results,
                error: undefined,
                timeMs: Date.now() - startTime
            };
        } catch (error: any) {
            this.logger.error(`Error searching with DuckDuckGo: ${error.message}`);
            return {
                success: false,
                engine: 'duckduckgo',
                query,
                results: [],
                error: `Failed to search with DuckDuckGo: ${error.message}`,
                timeMs: Date.now() - startTime
            };
        }
    }
    
    /**
     * Search using Google
     */
    private async searchWithGoogle(
        query: string,
        numResults: number,
        safeSearch: boolean,
        timeRange?: 'day' | 'week' | 'month' | 'year'
    ): Promise<WebSearchResult> {
        const startTime = Date.now();
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
        
        try {
            // Google search parameters
            let url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${numResults}`;
            
            // Add safe search parameter
            url += safeSearch ? '&safe=active' : '&safe=off';
            
            // Add time range if specified
            if (timeRange) {
                const timeParam = timeRange === 'day' ? 'd' : 
                                timeRange === 'week' ? 'w' : 
                                timeRange === 'month' ? 'm' : 'y';
                url += `&tbs=qdr:${timeParam}`;
            }

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'text/html',
                }
            });            const dom = new JSDOM(response.data);
            const document = dom.window.document;
            
            // Extract search results from Google's HTML
            const results: Array<{
                title: string;
                url: string;
                snippet: string;
                position: number;
            }> = [];
            const resultElements = document.querySelectorAll('div.g');
            
            for (let i = 0; i < resultElements.length && results.length < numResults; i++) {
                const element = resultElements[i];
                const titleElement = element.querySelector('h3');
                const linkElement = element.querySelector('a');
                const snippetElement = element.querySelector('div.VwiC3b');
                
                if (titleElement && linkElement && linkElement.href) {
                    const title = titleElement.textContent?.trim() || '';
                    const url = new URL(linkElement.href, 'https://www.google.com').href;
                    const snippet = snippetElement?.textContent?.trim() || '';
                    
                    // Filter out non-http URLs
                    if (url.startsWith('http')) {
                        results.push({
                            title,
                            url,
                            snippet,
                            position: results.length + 1
                        });
                    }
                }
            }

            return {
                success: true,
                engine: 'google',
                query,
                results,
                error: undefined,
                timeMs: Date.now() - startTime
            };
        } catch (error: any) {
            this.logger.error(`Error searching with Google: ${error.message}`);
            return {
                success: false,
                engine: 'google',
                query,
                results: [],
                error: `Failed to search with Google: ${error.message}`,
                timeMs: Date.now() - startTime
            };
        }
    }
    
    /**
     * Search using SearXNG (using a public instance)
     */
    private async searchWithSearXNG(
        query: string,
        numResults: number,
        safeSearch: boolean,
        timeRange?: 'day' | 'week' | 'month' | 'year'
    ): Promise<WebSearchResult> {
        const startTime = Date.now();
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
        
        // Use a public SearXNG instance
        // Note: The availability of public instances may change over time
        const searxngInstance = 'http://search.k2o';
        
        try {
            // SearXNG search parameters
            let url = `${searxngInstance}/search?q=${encodeURIComponent(query)}&format=html&categories=general`;
            
            // Add safe search parameter
            url += safeSearch ? '&safesearch=2' : '&safesearch=0';
            
            // Add time range if specified
            if (timeRange) {
                const timeParam = timeRange === 'day' ? 'day' : 
                                timeRange === 'week' ? 'week' : 
                                timeRange === 'month' ? 'month' : 'year';
                url += `&time_range=${timeParam}`;
            }
            
            // Add number of results
            url += `&results=${numResults}`;

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'text/html',
                }
            });

            const dom = new JSDOM(response.data);
            const document = dom.window.document;
            
            // Extract search results from SearXNG's HTML
            const resultElements = document.querySelectorAll('.result');
            const results = Array.from(resultElements).slice(0, numResults).map((result, index) => {
                const titleElement = result.querySelector('.result-title a');
                const urlElement = result.querySelector('.result-url');
                const contentElement = result.querySelector('.result-content');
                
                const title = titleElement?.textContent?.trim() || '';
                const url = titleElement?.getAttribute('href') || '';
                const snippet = contentElement?.textContent?.trim() || '';
                
                return {
                    title,
                    url,
                    snippet,
                    position: index + 1,
                };
            });

            return {
                success: true,
                engine: 'searxng',
                query,
                results,
                error: undefined,
                timeMs: Date.now() - startTime
            };
        } catch (error: any) {
            this.logger.error(`Error searching with SearXNG: ${error.message}`);
            return {
                success: false,
                engine: 'searxng',
                query,
                results: [],
                error: `Failed to search with SearXNG: ${error.message}`,
                timeMs: Date.now() - startTime
            };
        }
    }
    
    /**
     * Extract actual URL from DuckDuckGo's redirect URLs
     */
    private extractUrlFromDDGHref(href: string): string {
        try {
            // DuckDuckGo uses redirects in format /d.js?q=...
            if (href.startsWith('/d.js?')) {
                const params = new URLSearchParams(href.substring(5));
                const decodedUrl = params.get('uddg');
                if (decodedUrl) return decodeURIComponent(decodedUrl);
            }
            return href;
        } catch (e) {
            return href;
        }
    }
}
