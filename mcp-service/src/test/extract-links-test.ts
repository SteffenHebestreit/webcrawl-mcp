import { CrawlExecutionService } from '../services/crawlExecutionService';
import { ToolController } from '../controllers/toolController';
import { createLogger } from '../utils/logger';

const logger = createLogger('ExtractLinksTest');

/**
 * Test the new extractLinks tool functionality
 */
async function testExtractLinks() {
    logger.info('Starting extractLinks tool test...');
    
    try {
        // Initialize services
        const crawlExecutor = new CrawlExecutionService();
        const toolController = new ToolController({}, crawlExecutor);
        
        // Test URL (a page likely to have internal links)
        const testUrl = 'https://example.com';
        
        // Test the extractLinks tool
        const extractLinksConfig = toolController.getExtractLinksToolConfig();
        
        logger.info('Testing extractLinks with basic parameters...');
        const basicResult = await extractLinksConfig.execute({
            url: testUrl,
            maxLinks: 20,
            categorizeLinks: true,
            sortBy: 'relevance'
        });
        
        logger.info('Basic extractLinks result:', {
            success: basicResult.success,
            totalLinks: basicResult.totalLinks,
            linksByType: basicResult.linksByType,
            sampleLinks: basicResult.links.slice(0, 3).map(l => ({
                url: l.url,
                text: l.text,
                type: l.type,
                depth: l.depth
            }))
        });
        
        // Test with different parameters
        logger.info('Testing extractLinks with fragments disabled...');
        const noFragmentsResult = await extractLinksConfig.execute({
            url: testUrl,
            includeFragments: false,
            includeQueryParams: false,
            maxLinks: 10,
            sortBy: 'url'
        });
        
        logger.info('No fragments result:', {
            success: noFragmentsResult.success,
            totalLinks: noFragmentsResult.totalLinks,
            sampleUrls: noFragmentsResult.links.slice(0, 3).map(l => l.url)
        });
        
        // Test direct service method
        logger.info('Testing direct extractInternalLinks service method...');
        const directResult = await crawlExecutor.extractInternalLinks(
            testUrl,
            true,  // includeFragments
            true,  // includeQueryParams
            true,  // categorizeLinks
            15     // maxLinks
        );
        
        logger.info('Direct service result:', {
            success: directResult.success,
            linksCount: directResult.links.length,
            pageTitle: directResult.pageTitle,
            baseUrl: directResult.baseUrl        });
        
        // Browser is automatically closed in extractInternalLinks method
        
        logger.info('ExtractLinks tool test completed successfully!');
        
    } catch (error) {
        logger.error('ExtractLinks tool test failed:', error);
        throw error;
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testExtractLinks()
        .then(() => {
            logger.info('All extractLinks tests passed!');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('ExtractLinks test failed:', error);
            process.exit(1);
        });
}

export { testExtractLinks };
