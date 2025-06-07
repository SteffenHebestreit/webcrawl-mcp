/**
 * Define the structure of the crawl result (internal interface)
 */
export interface CrawlResult {
    success: boolean;
    url: string;
    markdown?: string;
    text?: string;
    media?: { tables?: any[] };
    images?: Array<{
        src: string;
        alt?: string;
        title?: string;
        caption?: string;
    }>;
    metadata?: {
        title?: string;
        description?: string;
        keywords?: string[];
        language?: string;
        author?: string;
        publishDate?: string;
    };
    links?: Array<{
        url: string;
        text: string;
        relevance: number;
    }>;
    error?: string;
    traceback?: string;
}

/**
 * Define the structure of a web search result
 */
export interface WebSearchResult {
    success: boolean;
    engine: 'google' | 'duckduckgo' | 'searxng';
    query: string;
    results: Array<{
        title: string;
        url: string;
        snippet: string;
        position: number;
    }>;
    error?: string;
    timeMs: number;
}
