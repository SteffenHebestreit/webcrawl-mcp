import { ExtractLinksParams, ExtractLinksResponse } from '../../types/mcp';
import { CrawlExecutionService } from '../crawlExecutionService';
import { createLogger } from '../../utils/logger';

/**
 * Tool service for extracting links from web pages
 */
export class ExtractLinksTool {
  private logger = createLogger('ExtractLinksTool');
  private crawlExecutor: CrawlExecutionService;

  constructor(crawlExecutor: CrawlExecutionService) {
    this.crawlExecutor = crawlExecutor;
  }

  /**
   * Execute link extraction from a specific page
   */
  public async executeExtractLinks(params: ExtractLinksParams): Promise<ExtractLinksResponse> {
    this.logger.info('Executing extractLinks with params:', params);
    
    try {
      const extractedLinks = await this.crawlExecutor.extractInternalLinks(
        params.url,
        params.includeFragments ?? true,
        params.includeQueryParams ?? true,
        params.categorizeLinks ?? true,
        params.maxLinks ?? 100
      );

      if (!extractedLinks.success) {
        return {
          success: false,
          url: params.url,
          links: [],
          totalLinks: 0,
          baseUrl: params.url,
          error: extractedLinks.error || 'Failed to extract links'
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
            const typeDiff = typePriority[a.type] - typePriority[b.type];
            if (typeDiff !== 0) return typeDiff;
            return b.text.length - a.text.length;
          });
          break;
      }

      const linksByType = params.categorizeLinks ? {
        navigation: sortedLinks.filter(l => l.type === 'navigation').length,
        content: sortedLinks.filter(l => l.type === 'content').length,
        media: sortedLinks.filter(l => l.type === 'media').length,
        form: sortedLinks.filter(l => l.type === 'form').length,
        other: sortedLinks.filter(l => l.type === 'other').length
      } : undefined;

      return {
        success: true,
        url: params.url,
        links: sortedLinks,
        linksByType,
        totalLinks: sortedLinks.length,
        pageTitle: extractedLinks.pageTitle,
        baseUrl: extractedLinks.baseUrl,
        error: undefined
      };
    } catch (error: any) {
      this.logger.error('Error in ExtractLinksTool executeExtractLinks:', error);
      return {
        success: false,
        url: params.url,
        links: [],
        totalLinks: 0,
        baseUrl: params.url,
        error: error.message
      };
    }
  }
}
