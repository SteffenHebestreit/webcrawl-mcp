import { ToolController } from '../controllers/toolController';
import { CrawlExecutionService } from '../services/crawlExecutionService';
import { createLogger } from '../utils/logger';
import config from '../config';

const logger = createLogger('ContentCrawlerRelevanceTest');

async function testContentCrawlerRelevance() {
    logger.info('Starting content crawler relevance test...');
    
    try {
        const crawlExecutor = new CrawlExecutionService();
        const toolController = new ToolController(config, crawlExecutor);
        
        // First, let's test direct ContentCrawler execution
        logger.info('Testing direct ContentCrawler execution...');
        const contentResult = await toolController.getCrawlToolConfig().execute({
            url: 'https://www.eurojackpot.de',
            query: 'Extract winning numbers and jackpot amount',
            extractMetadata: true,
            maxPages: 1,
            depth: 0
        });
        
        // Log the full raw text that ContentCrawler extracts
        logger.info('ContentCrawler full raw text before query processing:');
        logger.info('Length:', contentResult.text?.length || 0);
        logger.info('First 1000 chars:', contentResult.text?.substring(0, 1000));
        
        // Now test the SmartCrawlTool execution
        logger.info('Testing SmartCrawlTool execution...');
        const smartResult = await toolController.getSmartCrawlToolConfig().execute({
            url: 'https://www.eurojackpot.de',
            query: 'Extract winning numbers and jackpot amount',
            maxPages: 1,
            depth: 0
        });
        
        // Log the smart crawl results
        logger.info('SmartCrawlTool results:');
        logger.info('Success:', smartResult.success);
        logger.info('Overall summary:', smartResult.overallSummary);
        logger.info('Relevant pages:', smartResult.relevantPages.length);
        logger.info('Relevance score:', smartResult.relevantPages[0]?.relevanceScore || 'N/A');
        logger.info('First page summary:', smartResult.relevantPages[0]?.summary || 'N/A');
        
        // Check if the relevance threshold filtering is happening
        if (smartResult.relevantPages.length === 0) {
            logger.warn('🚨 ISSUE IDENTIFIED: SmartCrawlTool is filtering out content due to relevance threshold!');
            logger.warn('The content is being extracted correctly, but then filtered by relevanceThreshold criteria');
        } else {
            logger.info('✅ SmartCrawlTool returns relevant content');
        }
        
        // Also test the markdown tool since that's what the user was having issues with
        logger.info('Testing CrawlWithMarkdown execution...');
        const markdownResult = await toolController.getMarkdownCrawlToolConfig().execute({
            url: 'https://www.eurojackpot.de',
            query: 'Extract winning numbers and jackpot amount',
            maxPages: 1,
            depth: 0
        });
        
        logger.info('CrawlWithMarkdown results:');
        logger.info('Success:', markdownResult.success);
        logger.info('Markdown length:', markdownResult.markdown?.length || 0);
        logger.info('First 500 chars:', markdownResult.markdown?.substring(0, 500));
        
    } catch (error: any) {
        logger.error('Error in content crawler relevance test:', error);
    }
}

// Run the test
testContentCrawlerRelevance().catch(error => {
    logger.error('Content crawler relevance test failed:', error);
    process.exit(1);
});
