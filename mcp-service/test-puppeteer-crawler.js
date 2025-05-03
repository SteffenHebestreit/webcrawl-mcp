// A simple test script to verify our Puppeteer-based crawler

const { CrawlExecutionService } = require('./dist/services/crawlExecutionService');

// Create a new instance of the crawler
const crawler = new CrawlExecutionService();

// Test URL - using a public site
const testUrl = 'https://example.com';

// Test crawling with basic options
async function testCrawl() {
    console.log(`Starting test crawl of ${testUrl}`);
    
    try {
        const result = await crawler.executeCrawl(testUrl, {
            maxPages: 1,
            depth: 0,
            strategy: 'bfs',
            waitTime: 2000,
            captureScreenshots: true
        });
        
        console.log('Crawl result summary:');
        console.log(`- Success: ${result.success}`);
        console.log(`- URL: ${result.url}`);
        console.log(`- Text length: ${result.text?.length || 0} characters`);
        console.log(`- Markdown length: ${result.markdown?.length || 0} characters`);
        console.log(`- Tables extracted: ${result.media?.tables?.length || 0}`);
        
        // Display a sample of the extracted content
        console.log('\nExtracted text sample:');
        console.log(result.text?.substring(0, 300) + '...');
        
        console.log('\nExtracted markdown sample:');
        console.log(result.markdown?.substring(0, 300) + '...');
        
    } catch (error) {
        console.error('Error during test crawl:', error);
    } finally {
        // Close the browser to clean up resources
        await crawler.closeBrowser();
        console.log('Test completed and browser closed.');
    }
}

// Run the test
testCrawl();
