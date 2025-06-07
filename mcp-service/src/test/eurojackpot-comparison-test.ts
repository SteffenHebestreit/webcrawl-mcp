import { ToolController } from '../controllers/toolController';
import { CrawlExecutionService } from '../services/crawlExecutionService';
import { createLogger } from '../utils/logger';
import config from '../config';

const logger = createLogger('EurojackpotComparisonTest');

async function testEurojackpotCrawling() {
    logger.info('Testing eurojackpot.de crawling with both SitemapCrawler and ContentCrawler...');
    
    try {
        // Create service and controller instances
        const crawlExecutor = new CrawlExecutionService();
        const toolController = new ToolController(config, crawlExecutor);
        
        const testUrl = 'https://www.eurojackpot.de';
        
        logger.info('Test 1: Using SitemapCrawler (WORKING)...');
        
        // Test with SitemapCrawler - this works
        const sitemapParams = {
            url: testUrl,
            depth: 1,
            maxPages: 1,
            includeMetadata: true
        };
        
        const sitemapResult = await toolController.getSitemapGeneratorToolConfig().execute(sitemapParams);
        
        logger.info('SitemapCrawler result:', {
            success: sitemapResult.success,
            totalPages: sitemapResult.sitemap.length,
            firstPageTitle: sitemapResult.sitemap[0]?.title,
            firstPageDescription: sitemapResult.sitemap[0]?.description,
            hasProperContent: sitemapResult.sitemap[0]?.title?.includes('EUROJACKPOT') || false
        });
        
        logger.info('Test 2: Using ContentCrawler (PROBLEMATIC)...');
        
        // Test with ContentCrawler - this returns CSS
        const contentParams = {
            url: testUrl,
            query: 'Extract lottery numbers and jackpot information',
            maxPages: 1,
            depth: 0
        };
        
        const contentResult = await toolController.getCrawlToolConfig().execute(contentParams);
        
        logger.info('ContentCrawler result:', {
            success: contentResult.success,
            hasContent: !!contentResult.text,
            contentLength: contentResult.text?.length || 0,
            contentPreview: contentResult.text?.substring(0, 300) + '...',
            containsCSS: contentResult.text?.includes('font-family') || contentResult.text?.includes('margin:') || false,
            containsLotteryInfo: contentResult.text?.includes('EUROJACKPOT') || contentResult.text?.includes('Gewinnzahlen') || false
        });
        
        logger.info('Test 3: Using CrawlWithMarkdown (ALTERNATIVE)...');
        
        // Test with markdown crawler as alternative
        const markdownParams = {
            url: testUrl,
            query: 'Extract lottery information',
            maxPages: 1
        };
        
        const markdownResult = await toolController.getMarkdownCrawlToolConfig().execute(markdownParams);
        
        logger.info('MarkdownCrawler result:', {
            success: markdownResult.success,
            hasMarkdown: !!markdownResult.markdown,
            markdownLength: markdownResult.markdown?.length || 0,
            markdownPreview: markdownResult.markdown?.substring(0, 300) + '...',
            containsLotteryInfo: markdownResult.markdown?.includes('EUROJACKPOT') || markdownResult.markdown?.includes('Gewinnzahlen') || false
        });
        
        // Analysis
        logger.info('=== ANALYSIS ===');
        
        const sitemapWorks = sitemapResult.success && (sitemapResult.sitemap[0]?.title?.includes('EUROJACKPOT') || false);
        const contentHasIssues = contentResult.success && (contentResult.text?.includes('font-family') || false);
        const markdownWorks = markdownResult.success && (markdownResult.markdown?.includes('EUROJACKPOT') || false);
        
        logger.info('Results comparison:', {
            sitemapExtractsProperContent: sitemapWorks,
            contentCrawlerReturnsCSS: contentHasIssues,
            markdownCrawlerWorks: markdownWorks,
            issueConfirmed: sitemapWorks && contentHasIssues
        });
        
        if (sitemapWorks && contentHasIssues) {
            logger.info('✅ ISSUE CONFIRMED: SitemapCrawler works, ContentCrawler returns CSS');
            logger.info('🔧 This confirms our fix is needed: ContentCrawler should use innerText like SitemapCrawler');
        } else {
            logger.info('❓ Results differ from expected pattern');
        }
        
    } catch (error: any) {
        logger.error('Error in eurojackpot crawling test:', error);
        throw error;
    }
}

// Run the test
testEurojackpotCrawling().catch(error => {
    logger.error('Eurojackpot crawling test failed:', error);
    process.exit(1);
});
