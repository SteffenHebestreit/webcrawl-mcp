import { ToolController } from '../controllers/toolController';
import { CrawlExecutionService } from '../services/crawlExecutionService';
import { createLogger } from '../utils/logger';
import config from '../config';

const logger = createLogger('EurojackpotLiveTest');

async function testEurojackpotCrawlers() {
    logger.info('Starting Eurojackpot crawler comparison test...');
    
    try {
        const crawlExecutor = new CrawlExecutionService();
        const toolController = new ToolController(config, crawlExecutor);
          logger.info('=== Testing ContentCrawler on eurojackpot.de ===');
        const contentResult = await toolController.getCrawlToolConfig().execute({
            url: 'https://www.eurojackpot.de',
            query: 'Extract winning numbers and jackpot amount',
            extractMetadata: true,
            maxPages: 1,
            depth: 0
        });
        
        logger.info('ContentCrawler result:', {
            success: contentResult.success,
            hasContent: !!contentResult.text,
            contentLength: contentResult.text?.length || 0,
            contentPreview: contentResult.text?.substring(0, 500),
            containsCSS: contentResult.text?.includes('font-family') || contentResult.text?.includes('margin:') || contentResult.text?.includes('display:'),
            containsNumbers: /(?:(?:^|\s)\d{1,2}(?:$|\s)){3,}|(?:\d{1,3}(?:[,.]\d{3})+|\d{5,})/.test(contentResult.text || ''), // More robust regex for various number patterns
            metadata: contentResult.metadata
        });
          logger.info('=== Testing SitemapCrawler on eurojackpot.de ===');
        const sitemapResult = await toolController.getSitemapGeneratorToolConfig().execute({
            url: 'https://www.eurojackpot.de',
            depth: 1,
            maxPages: 1,
            includeMetadata: true
        });
        
        logger.info('SitemapCrawler result:', {
            success: sitemapResult.success,
            totalPages: sitemapResult.sitemap.length,
            firstPageTitle: sitemapResult.sitemap[0]?.title,
            firstPageWordCount: sitemapResult.sitemap[0]?.wordCount,
            hasValidContent: (sitemapResult.sitemap[0]?.wordCount || 0) > 10,
            sitemapEntry: sitemapResult.sitemap[0]
        });
        
        // Analysis
        const contentWorking = contentResult.success && contentResult.text && contentResult.text.length > 100;
        const sitemapWorking = sitemapResult.success && sitemapResult.sitemap.length > 0;
        const contentHasCSS = contentResult.text?.includes('font-family') || contentResult.text?.includes('margin:') || false;
        
        logger.info('=== ANALYSIS ===');
        logger.info('Comparison results:', {
            contentCrawlerWorking: contentWorking,
            sitemapCrawlerWorking: sitemapWorking,
            contentCrawlerHasCSS: contentHasCSS,
            bothWorkingSame: contentWorking === sitemapWorking,
            issueFound: contentHasCSS || !contentWorking
        });
        
        if (contentHasCSS) {
            logger.warn('🚨 ISSUE CONFIRMED: ContentCrawler is still extracting CSS/HTML instead of clean text!');
            logger.warn('ContentCrawler preview with CSS:', contentResult.text?.substring(0, 800));
        }
        
        if (!contentWorking && sitemapWorking) {
            logger.warn('🚨 ISSUE CONFIRMED: SitemapCrawler works but ContentCrawler fails!');
        }
        
        if (contentWorking && !contentHasCSS) {
            logger.info('✅ ContentCrawler is working correctly with clean text!');
        }
        
    } catch (error: any) {
        logger.error('Error in Eurojackpot crawler test:', error);
        throw error;
    }
}

// Run the test
testEurojackpotCrawlers().catch(error => {
    logger.error('Eurojackpot crawler test failed:', error);
    process.exit(1);
});
