import { SmartCrawlParams, SmartCrawlResponse } from '../../types/mcp';
import { CrawlExecutionService } from '../crawlExecutionService';
import { createLogger } from '../../utils/logger';

/**
 * Tool service for intelligent crawling with relevance scoring
 */
export class SmartCrawlTool {
  private logger = createLogger('SmartCrawlTool');
  private crawlExecutor: CrawlExecutionService;

  constructor(crawlExecutor: CrawlExecutionService) {
    this.crawlExecutor = crawlExecutor;
  }

  /**
   * Execute smart crawl with relevance scoring
   */
  public async executeSmartCrawl(params: SmartCrawlParams): Promise<SmartCrawlResponse> {
    this.logger.info('Executing smartCrawl with params:', params);
    
    try {
      const crawlResult = await this.crawlExecutor.executeCrawl(params.url, {
        url: params.url,
        maxPages: params.maxPages || 5,
        depth: params.depth || 2,
        strategy: 'bestFirst',
        query: params.query
      });

      if (!crawlResult.success) {
        return {
          success: false,
          url: params.url,
          query: params.query,
          relevantPages: [],
          overallSummary: '',
          error: crawlResult.error || 'Failed to perform smart crawl'
        };
      }      const searchResults = this.crawlExecutor.searchInContent(crawlResult.text || '', params.query);
      
      // Apply a lower threshold for lottery/jackpot content
      let relevanceThreshold = params.relevanceThreshold || 2;
      const isLotteryQuery = /lott(ery|o)|jackpot|eurojackpot|winning|numbers|gewinn|zahlen/i.test(params.query);
      
      this.logger.info('Content relevance assessment:', {
        queryLength: params.query.length,
        contentLength: crawlResult.text?.length || 0,
        isLotteryQuery: isLotteryQuery,
        originalThreshold: relevanceThreshold,
        matchesFound: searchResults.matches.length,
        highestRelevance: searchResults.matches.length > 0 ? 
          Math.max(...searchResults.matches.map(m => m.relevance)) : 0
      });
      
      if (isLotteryQuery && crawlResult.text && crawlResult.text.length > 0) {
        relevanceThreshold = 0.5; // Lower threshold for lottery content
        this.logger.info('Applying lower relevance threshold for lottery/jackpot content:', relevanceThreshold);
      }

      // If we have content but no matches above threshold, use the content directly
      let summary = searchResults.summary;
      if (searchResults.matches.length === 0 && crawlResult.text && crawlResult.text.length > 0) {
        this.logger.info('No relevant matches found but content exists, using raw content');
        summary = crawlResult.text.substring(0, Math.min(3500, crawlResult.text.length));
      }

      const relevantPages = [{
        url: params.url,
        title: 'Main Page',
        summary: summary,
        relevanceScore: searchResults.matches.length > 0 ? 
          Math.max(...searchResults.matches.map(m => m.relevance)) : 
          (crawlResult.text && crawlResult.text.length > 100 ? 1 : 0),
        keyFindings: searchResults.matches
          .filter(m => m.relevance >= relevanceThreshold)          .slice(0, 5)
          .map(m => m.snippet.substring(0, 100) + '...')
      }];

      // Don't filter out content if it's a lottery query and we have some text
      const shouldFilterByRelevance = !(isLotteryQuery && crawlResult.text && crawlResult.text.length > 100);
      
      // Only filter by relevance threshold if appropriate
      const filteredPages = shouldFilterByRelevance ? 
        relevantPages.filter(page => page.relevanceScore >= relevanceThreshold) : 
        relevantPages;

      const overallSummary = filteredPages.length > 0 
        ? `Found ${searchResults.matches.length} relevant matches for "${params.query}". ${searchResults.summary}`
        : `No content meeting the relevance threshold was found for "${params.query}".`;

      return {
        success: true,
        url: params.url,
        query: params.query,
        relevantPages: filteredPages,
        overallSummary,
        error: undefined
      };
    } catch (error: any) {
      this.logger.error('Error in SmartCrawlTool executeSmartCrawl:', error);
      return {
        success: false,
        url: params.url,
        query: params.query,
        relevantPages: [],
        overallSummary: '',
        error: error.message
      };
    }
  }
}
