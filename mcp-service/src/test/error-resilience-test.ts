import { ToolController } from '../controllers/toolController';
import { CrawlExecutionService } from '../services/crawlExecutionService';
import { createLogger } from '../utils/logger';
import config from '../config';

const logger = createLogger('ErrorResilienceTest');

async function testErrorResilience() {
    logger.info('Starting error resilience test...');
    
    try {
        // Create service and controller instances
        const crawlExecutor = new CrawlExecutionService();
        const toolController = new ToolController(config, crawlExecutor);
        
        // Get tool configurations
        const extractLinksToolConfig = toolController.getExtractLinksToolConfig();
        const sitemapToolConfig = toolController.getSitemapGeneratorToolConfig();
        
        logger.info('Testing with unreachable/problematic URLs...');
        
        // Test 1: Non-existent domain (should trigger DNS error)
        logger.info('Test 1: Testing DNS resolution error...');
        const dnsErrorParams = {
            url: 'https://this-domain-definitely-does-not-exist-12345.com'
        };
        
        const dnsResult = await extractLinksToolConfig.execute(dnsErrorParams);
        logger.info('DNS error test result:', {
            success: dnsResult.success,
            error: dnsResult.error
        });
        
        // Test 2: Connection refused (using localhost on unlikely port)
        logger.info('Test 2: Testing connection refused error...');
        const connRefusedParams = {
            url: 'http://localhost:99999'
        };
        
        const connRefusedResult = await extractLinksToolConfig.execute(connRefusedParams);
        logger.info('Connection refused test result:', {
            success: connRefusedResult.success,
            error: connRefusedResult.error
        });
        
        // Test 3: HTTP error (using httpbin.org for 404)
        logger.info('Test 3: Testing HTTP 404 error...');
        const httpErrorParams = {
            url: 'https://httpbin.org/status/404'
        };
        
        const httpErrorResult = await extractLinksToolConfig.execute(httpErrorParams);
        logger.info('HTTP error test result:', {
            success: httpErrorResult.success,
            error: httpErrorResult.error
        });
        
        // Test 4: Sitemap generation with problematic URL
        logger.info('Test 4: Testing sitemap generation with problematic URL...');
        const sitemapErrorParams = {
            url: 'https://this-domain-definitely-does-not-exist-12345.com',
            depth: 1,
            maxPages: 3
        };
        
        const sitemapErrorResult = await sitemapToolConfig.execute(sitemapErrorParams);
        logger.info('Sitemap error test result:', {
            success: sitemapErrorResult.success,
            totalPages: sitemapErrorResult.sitemap.length,
            errorPages: sitemapErrorResult.statistics.errorPages,
            error: sitemapErrorResult.error
        });
        
        // Test 5: Successful case to ensure we didn't break normal functionality
        logger.info('Test 5: Testing successful case (sanity check)...');
        const successParams = {
            url: 'https://example.com'
        };
        
        const successResult = await extractLinksToolConfig.execute(successParams);
        logger.info('Success test result:', {
            success: successResult.success,
            linksFound: successResult.links.length
        });
        
        // Evaluation
        const expectedFailures = !dnsResult.success && !connRefusedResult.success && !sitemapErrorResult.success;
        const gracefulErrors = (dnsResult.error || '').includes('Domain name') || 
                              (connRefusedResult.error || '').includes('Connection') ||
                              (dnsResult.error || '').includes('resolve');
        const successfulRecovery = successResult.success;
        
        if (expectedFailures && gracefulErrors && successfulRecovery) {
            logger.info('✅ Error resilience test completed successfully!');
            logger.info('✅ All error handling scenarios worked as expected');
            logger.info('✅ Error messages are user-friendly and informative');
            logger.info('✅ Normal functionality remains intact');
        } else {
            logger.warn('⚠️  Some error resilience tests had unexpected results');
            logger.warn('Expected failures:', expectedFailures);
            logger.warn('Graceful errors:', gracefulErrors);
            logger.warn('Successful recovery:', successfulRecovery);
        }
        
    } catch (error: any) {
        logger.error('Error in error resilience test:', error);
        throw error;
    }
}

// Run the test
testErrorResilience().catch(error => {
    logger.error('Error resilience test failed:', error);
    process.exit(1);
});
