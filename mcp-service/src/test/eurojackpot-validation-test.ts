import { ToolController } from '../controllers/toolController';
import { CrawlExecutionService } from '../services/crawlExecutionService';
import { createLogger } from '../utils/logger';
import config from '../config';

const logger = createLogger('EurojackpotValidationTest');

async function testEurojackpotFix() {
    logger.info('Starting Eurojackpot validation test - testing the real-world scenario from conversation...');
    
    try {
        // Create service and controller instances
        const crawlExecutor = new CrawlExecutionService();
        const toolController = new ToolController(config, crawlExecutor);
        
        logger.info('Test 1: ContentCrawler (fixed) with eurojackpot.de...');
        
        // Test ContentCrawler with eurojackpot.de - the real failing case from conversation
        const contentParams = {
            url: 'https://eurojackpot.de',
            query: 'Extract lottery data and winning numbers',
            includeMetadata: true,
            maxPages: 1,
            depth: 0
        };
        
        const contentResult = await toolController.getCrawlToolConfig().execute(contentParams);
        
        logger.info('ContentCrawler result:', {
            success: contentResult.success,
            hasContent: !!contentResult.text,
            contentLength: contentResult.text?.length || 0,
            containsLotteryData: contentResult.text?.toLowerCase().includes('eurojackpot') || false,
            containsCSSCode: contentResult.text?.includes('font-family') || contentResult.text?.includes('margin:') || false,
            contentPreview: contentResult.text?.substring(0, 300) + '...'
        });
        
        logger.info('Test 2: SitemapCrawler with eurojackpot.de for comparison...');
        
        // Test SitemapCrawler with same website for comparison
        const sitemapParams = {
            url: 'https://eurojackpot.de',
            depth: 1,
            maxPages: 1,
            includeMetadata: true
        };
        
        const sitemapResult = await toolController.getSitemapGeneratorToolConfig().execute(sitemapParams);
        
        logger.info('SitemapCrawler result:', {
            success: sitemapResult.success,
            totalPages: sitemapResult.sitemap.length,
            firstPageTitle: sitemapResult.sitemap[0]?.title,
            firstPageWordCount: sitemapResult.sitemap[0]?.wordCount,
            containsLotteryData: sitemapResult.sitemap[0]?.title?.toLowerCase().includes('eurojackpot') || false
        });
        
        logger.info('Test 3: Validation - ContentCrawler should now extract clean text like SitemapCrawler...');
        
        // Validation checks
        const contentHasLotteryData = contentResult.text?.toLowerCase().includes('eurojackpot') || 
                                    contentResult.text?.toLowerCase().includes('lotto') || 
                                    contentResult.text?.toLowerCase().includes('zahlen');
        
        const contentIsClean = contentResult.text && 
            !contentResult.text.includes('font-family') && 
            !contentResult.text.includes('margin:') &&
            !contentResult.text.includes('display:') &&
            !contentResult.text.includes('.css') &&
            !contentResult.text.includes('script');
            
        const sitemapHasLotteryData = sitemapResult.sitemap[0]?.title?.toLowerCase().includes('eurojackpot') ||
                                    sitemapResult.sitemap[0]?.title?.toLowerCase().includes('lotto');
        
        logger.info('Validation results:', {
            contentCrawlerSuccess: contentResult.success,
            contentHasLotteryData: contentHasLotteryData,
            contentIsClean: contentIsClean,
            sitemapCrawlerSuccess: sitemapResult.success,
            sitemapHasLotteryData: sitemapHasLotteryData,
            issueFixed: contentResult.success && contentHasLotteryData && contentIsClean
        });
        
        // Final assessment
        if (contentResult.success && contentHasLotteryData && contentIsClean) {
            logger.info('🎉 SUCCESS: ContentCrawler fallback solution is working!');
            logger.info('✅ ContentCrawler now extracts clean, meaningful lottery data instead of CSS/HTML code');
            logger.info('✅ The eurojackpot.de issue has been resolved');
            
            if (sitemapResult.success && sitemapHasLotteryData) {
                logger.info('✅ Both crawlers are now working correctly and extracting meaningful content');
            }
        } else {
            logger.warn('❌ Issue not fully resolved:');
            logger.warn(`ContentCrawler success: ${contentResult.success}`);
            logger.warn(`ContentCrawler has lottery data: ${contentHasLotteryData}`);
            logger.warn(`ContentCrawler has clean text: ${contentIsClean}`);
            if (contentResult.error) {
                logger.warn(`ContentCrawler error: ${contentResult.error}`);
            }
        }
        
    } catch (error: any) {
        logger.error('Error in Eurojackpot validation test:', error);
        throw error;
    }
}

// Run the test with timeout
const testPromise = testEurojackpotFix();
const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Test timed out after 60 seconds')), 60000);
});

Promise.race([testPromise, timeoutPromise])
    .then(() => {
        logger.info('Eurojackpot validation test completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        logger.error('Eurojackpot validation test failed:', error);
        process.exit(1);
    });
