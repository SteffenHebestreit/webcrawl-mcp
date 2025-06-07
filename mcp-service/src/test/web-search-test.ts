/**
 * Test the web search functionality
 */

import { WebSearchCrawler } from '../services/crawlers/WebSearchCrawler';

async function testWebSearch() {
    const webSearchCrawler = new WebSearchCrawler();
    
    console.log('Testing DuckDuckGo search...');
    const ddgResult = await webSearchCrawler.executeWebSearch(
        'Node.js web framework comparison',
        'duckduckgo',
        5,
        true
    );
    
    console.log(`Search success: ${ddgResult.success}`);
    console.log(`Total results: ${ddgResult.results.length}`);
    console.log(`Search time: ${ddgResult.timeMs}ms`);
    console.log('\nTop 3 results:');
    
    ddgResult.results.slice(0, 3).forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.title}`);
        console.log(`   URL: ${result.url}`);
        console.log(`   Snippet: ${result.snippet.substring(0, 100)}...`);
    });
    
    if (!ddgResult.success) {
        console.error(`Error: ${ddgResult.error}`);
    }
    
    // Uncomment to test Google search
    /*
    console.log('\n\nTesting Google search...');
    const googleResult = await webSearchCrawler.executeWebSearch(
        'Node.js web framework comparison',
        'google',
        5,
        true
    );
    
    console.log(`Search success: ${googleResult.success}`);
    console.log(`Total results: ${googleResult.results.length}`);
    console.log(`Search time: ${googleResult.timeMs}ms`);
    
    if (!googleResult.success) {
        console.error(`Error: ${googleResult.error}`);
    }
    */
}

testWebSearch().catch(error => {
    console.error('Test failed:', error);
});
