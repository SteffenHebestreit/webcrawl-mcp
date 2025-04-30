import fetch from 'node-fetch';
import { ConfigService } from './configService';

/**
 * Service for handling requests to the Crawl4AI API
 */
export class CrawlService {
  private baseUrl: string;
  private config: ConfigService;

  constructor(config: ConfigService) {
    this.config = config;
    this.baseUrl = this.config.get('crawlServiceUrl');
  }

  /**
   * Call the Crawl4AI service API to crawl a website
   */
  async crawlWebsite(url: string, options: any = {}) {
    try {
      console.log(`Calling Crawl4AI service at ${this.baseUrl}/api/crawl for URL: ${url}`);
      
      // Apply default configuration values if not specified in the options
      const requestOptions = {
        maxPages: options.maxPages ?? this.config.get('crawlDefaultMaxPages'),
        depth: options.depth ?? this.config.get('crawlDefaultDepth'),
        strategy: options.strategy ?? this.config.get('crawlDefaultStrategy'),
        waitTime: options.waitTime ?? this.config.get('crawlDefaultWaitTime'),
        ...options
      };
      
      const response = await fetch(`${this.baseUrl}/api/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          ...requestOptions
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Crawl service error: ${response.status} ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error calling Crawl4AI service:', error);
      throw error;
    }
  }

  /**
   * Health check for the crawl service
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.error('Error checking crawl service health:', error);
      return false;
    }
  }
}