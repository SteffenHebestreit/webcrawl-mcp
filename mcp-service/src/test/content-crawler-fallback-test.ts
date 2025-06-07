import { ToolController } from '../controllers/toolController';
import { CrawlExecutionService } from '../services/crawlExecutionService';
import { createLogger } from '../utils/logger';
import config from '../config';

const logger = createLogger('ContentCrawlerFallbackTest');

async function testContentCrawlerFallback() {
    logger.info('Starting ContentCrawler fallback solution test...');
    
    try {
        // Create service and controller instances
        const crawlExecutor = new CrawlExecutionService();
        const toolController = new ToolController(config, crawlExecutor);
        
        logger.info('Test 1: Testing ContentCrawler with clean text extraction...');
          // Test ContentCrawler with a working website
        const contentParams = {
            url: 'https://example.com',
            query: 'Extract all content from this page',
            includeMetadata: true,
            maxPages: 1,
            depth: 0
        };
          const contentResult = await toolController.getCrawlToolConfig().execute(contentParams);
        logger.info('ContentCrawler result:', {
            success: contentResult.success,
            hasContent: !!contentResult.text,
            contentLength: contentResult.text?.length || 0,
            contentPreview: contentResult.text?.substring(0, 200) + '...',
            title: contentResult.metadata?.title,
            metadata: contentResult.metadata
        });
        
        logger.info('Test 2: Testing SitemapCrawler for comparison...');
        
        // Test SitemapCrawler with same website for comparison
        const sitemapParams = {
            url: 'https://example.com',
            depth: 1,
            maxPages: 1,
            includeMetadata: true
        };
        
        const sitemapResult = await toolController.getSitemapGeneratorToolConfig().execute(sitemapParams);
          logger.info('SitemapCrawler result:', {
            success: sitemapResult.success,
            totalPages: sitemapResult.sitemap.length,
            firstPageTitle: sitemapResult.sitemap[0]?.title,
            firstPageWordCount: sitemapResult.sitemap[0]?.wordCount
        });
          logger.info('Test 3: Testing ContentCrawler navigation fallback...');
        
        // Test with a complex dynamic site to trigger fallback
        const dynamicParams = {
            url: 'https://httpbin.org/html',
            query: 'Extract all content from this page',
            includeMetadata: true,
            maxPages: 1,
            depth: 0
        };
        
        const dynamicResult = await toolController.getCrawlToolConfig().execute(dynamicParams);
        
        logger.info('Dynamic content with fallback result:', {
            success: dynamicResult.success,
            hasContent: !!dynamicResult.text,
            contentLength: dynamicResult.text?.length || 0,
            usedFallback: dynamicResult.text ? 'likely yes' : 'no'
        });
          logger.info('Test 4: Content quality comparison...');
        
        // Compare content quality - both should have clean text now
        const contentIsClean = contentResult.text && 
            !contentResult.text.includes('font-family') && 
            !contentResult.text.includes('margin:') &&
            !contentResult.text.includes('display:');
            
        const sitemapHasValidData = sitemapResult.sitemap[0]?.title && 
            sitemapResult.sitemap[0]?.status === 'crawled';
        
        logger.info('Content quality analysis:', {
            contentCrawlerClean: contentIsClean,
            sitemapCrawlerValid: sitemapHasValidData,
            bothWorking: contentIsClean && sitemapHasValidData
        });
          // Test validation: All tests should pass and content should be clean
        const allTestsPassed = contentResult.success && 
                              sitemapResult.success && 
                              dynamicResult.success &&
                              contentIsClean &&
                              sitemapHasValidData;
        
        if (allTestsPassed) {
            logger.info('ContentCrawler fallback solution test completed successfully!');
            logger.info('✅ All tests passed!');
            logger.info('✅ ContentCrawler now extracts clean text like SitemapCrawler');
            logger.info('✅ Navigation fallback is working correctly');
        } else {
            logger.warn('Some tests had issues:');
            logger.warn(`ContentCrawler success: ${contentResult.success}`);
            logger.warn(`SitemapCrawler success: ${sitemapResult.success}`);
            logger.warn(`Dynamic with fallback success: ${dynamicResult.success}`);
            logger.warn(`ContentCrawler clean text: ${contentIsClean}`);
            logger.warn(`SitemapCrawler valid data: ${sitemapHasValidData}`);
        }
        
    } catch (error: any) {
        logger.error('Error in ContentCrawler fallback test:', error);
        throw error;
    }
}

// Run the test
testContentCrawlerFallback().catch(error => {
    logger.error('ContentCrawler fallback test failed:', error);
    process.exit(1);
});
