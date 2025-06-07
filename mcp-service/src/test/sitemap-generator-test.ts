import { ToolController } from '../controllers/toolController';
import { CrawlExecutionService } from '../services/crawlExecutionService';
import { createLogger } from '../utils/logger';
import config from '../config';

const logger = createLogger('SitemapGeneratorTest');

async function testSitemapGenerator() {
    logger.info('Starting sitemap generator tool test...');
    
    try {
        // Create service and controller instances
        const crawlExecutor = new CrawlExecutionService();
        const toolController = new ToolController(config, crawlExecutor);
        
        // Get the sitemap generator tool configuration
        const sitemapToolConfig = toolController.getSitemapGeneratorToolConfig();
        
        logger.info('Testing sitemap generator with basic parameters...');
        
        // Test with a simple website
        const basicParams = {
            url: 'https://steffen-hebestreit.com',
            depth: 1,
            maxPages: 5,
            includeMetadata: true
        };
        
        const basicResult = await sitemapToolConfig.execute(basicParams);
        
        logger.info('Basic sitemap result:', {
            success: basicResult.success,
            totalPages: basicResult.sitemap.length,
            statistics: basicResult.statistics,
            samplePages: basicResult.sitemap.slice(0, 2).map(page => ({
                url: page.url,
                title: page.title,
                status: page.status,
                depth: page.depth
            }))
        });
        
        logger.info('Testing sitemap generator with depth 2...');
        
        // Test with deeper crawling
        const deeperParams = {
            url: 'https://steffen-hebestreit.com',
            depth: 2,
            maxPages: 10,
            includeExternalLinks: false,
            excludePatterns: ['/admin/', '.pdf']
        };
        
        const deeperResult = await sitemapToolConfig.execute(deeperParams);
        
        logger.info('Deeper sitemap result:', {
            success: deeperResult.success,
            totalPages: deeperResult.sitemap.length,
            maxDepthReached: deeperResult.statistics.maxDepthReached,
            hierarchyKeys: Object.keys(deeperResult.hierarchy).length
        });
        
        logger.info('Testing direct generateSitemap service method...');
        
        // Test direct service method
        const directResult = await crawlExecutor.generateSitemap(
            'https://steffen-hebestreit.com',
            2,
            5,
            false,
            true,
            true,
            [],
            true
        );
        
        logger.info('Direct service result:', {
            success: directResult.success,
            pagesFound: directResult.sitemap.length,
            statistics: directResult.statistics,
            baseUrl: directResult.baseUrl
        });
          // Test validation: All tests should pass
        const allTestsPassed = basicResult.success && deeperResult.success && directResult.success;
        
        if (allTestsPassed) {
            logger.info('Sitemap generator tool test completed successfully!');
            logger.info('All sitemap generator tests passed!');
        } else {
            logger.error('Some sitemap generator tests failed');
            throw new Error('Sitemap generator tests failed');
        }
        
    } catch (error: any) {
        logger.error('Error in sitemap generator test:', error);
        throw error;
    }
}

// Run the test
testSitemapGenerator().catch(error => {
    logger.error('Sitemap generator test failed:', error);
    process.exit(1);
});
