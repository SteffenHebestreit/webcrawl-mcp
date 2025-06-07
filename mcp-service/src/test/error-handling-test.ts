import { ToolController } from '../controllers/toolController';
import { CrawlExecutionService } from '../services/crawlExecutionService';
import { createLogger } from '../utils/logger';
import config from '../config';

const logger = createLogger('ErrorHandlingTest');

async function testErrorHandling() {
    logger.info('Starting error handling test...');
    
    try {
        // Create service and controller instances
        const crawlExecutor = new CrawlExecutionService();
        const toolController = new ToolController(config, crawlExecutor);
        
        // Get the extract links tool configuration
        const extractLinksToolConfig = toolController.getExtractLinksToolConfig();
        
        logger.info('Testing error handling with problematic website...');
        
        // Test with the website that was causing issues
        const problemParams = {
            url: 'https://steffen-hebestreit.com',
            maxLinks: 10,
            includeFragments: true
        };
        
        logger.info('Attempting to extract links from problematic URL...');
        const problemResult = await extractLinksToolConfig.execute(problemParams);
        
        logger.info('Result from problematic URL:', {
            success: problemResult.success,
            error: problemResult.error,
            linksFound: problemResult.links?.length || 0
        });
        
        // Test with a working website for comparison
        logger.info('Testing with a reliable website for comparison...');
        const workingParams = {
            url: 'https://httpbin.org/html',
            maxLinks: 10,
            includeFragments: true
        };
        
        const workingResult = await extractLinksToolConfig.execute(workingParams);
        
        logger.info('Result from working URL:', {
            success: workingResult.success,
            error: workingResult.error,
            linksFound: workingResult.links?.length || 0
        });
        
        // Test sitemap generation with error handling
        logger.info('Testing sitemap generation error handling...');
        const sitemapToolConfig = toolController.getSitemapGeneratorToolConfig();
        
        const sitemapParams = {
            url: 'https://steffen-hebestreit.com',
            depth: 1,
            maxPages: 3,
            includeMetadata: true
        };
        
        const sitemapResult = await sitemapToolConfig.execute(sitemapParams);
        
        logger.info('Sitemap result for problematic URL:', {
            success: sitemapResult.success,
            error: sitemapResult.error,
            pagesFound: sitemapResult.sitemap?.length || 0,
            errorPages: sitemapResult.statistics?.errorPages || 0
        });
        
        // Summary
        logger.info('Error handling test completed!');
        logger.info('Summary:', {
            extractLinksWorked: problemResult.success || problemResult.error !== undefined,
            sitemapWorked: sitemapResult.success || sitemapResult.error !== undefined,
            improvedErrorMessages: !!(problemResult.error && problemResult.error.includes('Connection'))
        });
        
    } catch (error: any) {
        logger.error('Error in error handling test:', error);
        throw error;
    }
}

// Run the test
testErrorHandling().catch(error => {
    logger.error('Error handling test failed:', error);
    process.exit(1);
});
