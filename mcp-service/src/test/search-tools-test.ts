/**
 * Comprehensive tests for the new search tools (searchInPage and smartCrawl)
 */

import { ToolController } from '../controllers/toolController';
import { CrawlExecutionService } from '../services/crawlExecutionService';
import { Logger } from '../utils/logger';
import { SearchInPageParams, SmartCrawlParams } from '../types/mcp';

class SearchToolsTest {
    private toolController: ToolController;
    private logger: Logger;

    constructor() {
        this.logger = new Logger();
        const crawlExecutor = new CrawlExecutionService();
        this.toolController = new ToolController({}, crawlExecutor);
    }

    /**
     * Test the searchInPage tool with a real webpage
     */
    async testSearchInPage() {
        console.log('\n=== Testing searchInPage Tool ===');
        
        const testParams: SearchInPageParams = {
            url: 'https://httpbin.org/html',
            query: 'Herman Melville',
            maxResults: 5
        };

        try {
            const toolConfig = this.toolController.getSearchInPageToolConfig();
            const result = await toolConfig.execute(testParams);
            
            console.log('✅ searchInPage execution completed');
            console.log('Success:', result.success);
            console.log('URL:', result.url);
            console.log('Query:', result.query);
            console.log('Total Matches:', result.totalMatches);
            console.log('Matches Found:', result.matches.length);
            
            if (result.matches.length > 0) {
                console.log('Sample match:', {
                    snippet: result.matches[0].snippet.substring(0, 100) + '...',
                    relevance: result.matches[0].relevance
                });
            }
            
            console.log('Summary:', result.summary);
            
            if (result.error) {
                console.log('❌ Error:', result.error);
            }
            
            return result;
        } catch (error) {
            console.error('❌ Test failed:', error);
            throw error;
        }
    }

    /**
     * Test the smartCrawl tool with query-based crawling
     */
    async testSmartCrawl() {
        console.log('\n=== Testing smartCrawl Tool ===');
        
        const testParams: SmartCrawlParams = {
            url: 'https://httpbin.org/html',
            query: 'Moby Dick whale',
            maxPages: 2,
            depth: 1,
            relevanceThreshold: 1
        };

        try {
            const toolConfig = this.toolController.getSmartCrawlToolConfig();
            const result = await toolConfig.execute(testParams);
            
            console.log('✅ smartCrawl execution completed');
            console.log('Success:', result.success);
            console.log('URL:', result.url);
            console.log('Query:', result.query);
            console.log('Relevant Pages Found:', result.relevantPages.length);
            
            if (result.relevantPages.length > 0) {
                console.log('Sample relevant page:', {
                    url: result.relevantPages[0].url,
                    title: result.relevantPages[0].title,
                    relevanceScore: result.relevantPages[0].relevanceScore,
                    keyFindings: result.relevantPages[0].keyFindings.length
                });
            }
            
            console.log('Overall Summary:', result.overallSummary);
            
            if (result.error) {
                console.log('❌ Error:', result.error);
            }
            
            return result;
        } catch (error) {
            console.error('❌ Test failed:', error);
            throw error;
        }
    }

    /**
     * Test content search functionality directly
     */
    async testContentSearch() {
        console.log('\n=== Testing Content Search Functionality ===');
        
        const sampleContent = `
            Herman Melville was an American novelist, short story writer, and poet of the American Renaissance period.
            His best known work is Moby-Dick, a novel about the obsessive quest of Ahab, captain of the whaling ship Pequod.
            Melville's writing drew on his experience at sea as a common sailor, exploration of literature and philosophy,
            and engagement in the contradictions of American society in a period of rapid change.
        `;
        
        const crawlService = new CrawlExecutionService();
        const searchResult = crawlService.searchInContent(sampleContent, 'Moby Dick whale');
        
        console.log('✅ Content search completed');
        console.log('Matches found:', searchResult.matches.length);
        console.log('Summary:', searchResult.summary);
        
        searchResult.matches.forEach((match, index) => {
            console.log(`Match ${index + 1}:`, {
                snippet: match.snippet.substring(0, 80) + '...',
                relevance: match.relevance,
                position: match.position
            });
        });
        
        return searchResult;
    }

    /**
     * Test tool configuration validation
     */
    testToolConfigurations() {
        console.log('\n=== Testing Tool Configurations ===');
        
        try {
            const searchInPageConfig = this.toolController.getSearchInPageToolConfig();
            const smartCrawlConfig = this.toolController.getSmartCrawlToolConfig();
            
            console.log('✅ searchInPage tool config:', {
                name: searchInPageConfig.name,
                hasValidation: !!searchInPageConfig.parameters,
                hasExecutor: typeof searchInPageConfig.execute === 'function'
            });
            
            console.log('✅ smartCrawl tool config:', {
                name: smartCrawlConfig.name,
                hasValidation: !!smartCrawlConfig.parameters,
                hasExecutor: typeof smartCrawlConfig.execute === 'function'
            });
            
            return true;
        } catch (error) {
            console.error('❌ Configuration test failed:', error);
            return false;
        }
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🚀 Starting Search Tools Test Suite');
        console.log('=====================================');
        
        const results = {
            configTests: false,
            contentSearch: false,
            searchInPage: false,
            smartCrawl: false
        };
        
        try {
            // Test configurations first
            results.configTests = this.testToolConfigurations();
            
            // Test content search functionality
            await this.testContentSearch();
            results.contentSearch = true;
            
            // Test searchInPage tool
            await this.testSearchInPage();
            results.searchInPage = true;
            
            // Test smartCrawl tool
            await this.testSmartCrawl();
            results.smartCrawl = true;
            
            console.log('\n🎉 All tests completed successfully!');
            console.log('Results:', results);
            
        } catch (error) {
            console.error('\n💥 Test suite failed:', error);
            console.log('Partial results:', results);
        }
        
        return results;
    }
}

// Export for use in other test files or direct execution
export { SearchToolsTest };

// Allow direct execution
if (require.main === module) {
    const testSuite = new SearchToolsTest();
    testSuite.runAllTests().catch(console.error);
}
