import { ToolController } from '../controllers/toolController';
import { CrawlExecutionService } from '../services/crawlExecutionService';
import { createLogger } from '../utils/logger';

const logger = createLogger('CrawlWithMarkdownTest');

/**
 * Test the crawlWithMarkdown tool without providing a query parameter
 */
async function testCrawlWithMarkdownWithoutQuery() {
    logger.info('Starting crawlWithMarkdown test without query parameter...');
    
    try {
        // Initialize services
        const crawlExecutor = new CrawlExecutionService();
        const toolController = new ToolController({}, crawlExecutor);
        
        // Test URL
        const testUrl = 'https://example.com';
        
        // Get tool config
        const crawlWithMarkdownConfig = toolController.getMarkdownCrawlToolConfig();
        
        logger.info('Testing crawlWithMarkdown without query parameter...');
        const result = await crawlWithMarkdownConfig.execute({
            url: testUrl,
            maxPages: 1,
            depth: 0
        });
        
        logger.info('crawlWithMarkdown result (without query):', {
            success: result.success,
            url: result.url,
            query: result.query, // This should be the default generated query
            wordCount: result.wordCount,
            estimatedReadingTime: result.estimatedReadingTime
        });
        
        logger.info('Test completed successfully!');
        return result;
    } catch (error) {
        logger.error('Test failed:', error);
        throw error;
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testCrawlWithMarkdownWithoutQuery()
        .then((result) => {
            logger.info('Test passed!');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Test failed:', error);
            process.exit(1);
        });
}

export { testCrawlWithMarkdownWithoutQuery };
