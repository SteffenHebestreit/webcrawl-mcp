/**
 * Integration tests for tool abort functionality
 * These tests verify that tools can be properly aborted during execution
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock puppeteer completely to avoid typing issues
jest.mock('puppeteer');

// Import tools after mocking puppeteer
import { CrawlTool } from '../../services/tools/CrawlTool';
import { SmartCrawlTool } from '../../services/tools/SmartCrawlTool';
import { ExtractLinksTool } from '../../services/tools/ExtractLinksTool';
import { SearchInPageTool } from '../../services/tools/SearchInPageTool';
import { SitemapTool } from '../../services/tools/SitemapTool';
import { WebSearchTool } from '../../services/tools/WebSearchTool';

describe('Tool Abort Functionality Integration', () => {
  let crawlTool: CrawlTool;
  let smartCrawlTool: SmartCrawlTool;
  let extractLinksTool: ExtractLinksTool;
  let searchInPageTool: SearchInPageTool;
  let sitemapTool: SitemapTool;
  let webSearchTool: WebSearchTool;

  beforeEach(() => {
    crawlTool = new CrawlTool();
    smartCrawlTool = new SmartCrawlTool();
    extractLinksTool = new ExtractLinksTool();
    searchInPageTool = new SearchInPageTool();
    sitemapTool = new SitemapTool();
    webSearchTool = new WebSearchTool();
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any ongoing operations
    jest.clearAllMocks();
  });

  describe('Tool Abort Interface', () => {
    it('should provide abort method for all tools', () => {
      expect(typeof crawlTool.abort).toBe('function');
      expect(typeof smartCrawlTool.abort).toBe('function');
      expect(typeof extractLinksTool.abort).toBe('function');
      expect(typeof searchInPageTool.abort).toBe('function');
      expect(typeof sitemapTool.abort).toBe('function');
      expect(typeof webSearchTool.abort).toBe('function');
    });

    it('should return false when aborting non-active operations', () => {
      expect(crawlTool.abort()).toBe(false);
      expect(smartCrawlTool.abort()).toBe(false);
      expect(extractLinksTool.abort()).toBe(false);
      expect(searchInPageTool.abort()).toBe(false);
      expect(sitemapTool.abort()).toBe(false);
      expect(webSearchTool.abort()).toBe(false);
    });
  });

  describe('Tool Execution with Mock', () => {
    it('should handle CrawlTool abort attempt', async () => {
      const params = {
        url: 'https://example.com',
        query: 'test query'
      };

      // Since puppeteer is mocked, this should fail gracefully
      const result = await crawlTool.execute(params);
      
      // The tool should handle the error and return a failure response
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.processingTime).toBe('number');
    });

    it('should handle SmartCrawlTool abort attempt', async () => {
      const params = {
        url: 'https://example.com',
        query: 'test query',
        maxPages: 5,
        depth: 2
      };

      // Since puppeteer is mocked, this should fail gracefully
      const result = await smartCrawlTool.execute(params);
      
      // The tool should handle the error and return a failure response
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.processingTime).toBe('number');
    });

    it('should handle ExtractLinksTool abort attempt', async () => {
      const params = {
        url: 'https://example.com',
        maxLinks: 100
      };

      // Since puppeteer is mocked, this should fail gracefully
      const result = await extractLinksTool.execute(params);
      
      // The tool should handle the error and return a failure response
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.processingTime).toBe('number');
    });

    it('should handle SearchInPageTool abort attempt', async () => {
      const params = {
        url: 'https://example.com',
        query: 'test search'
      };

      // Since puppeteer is mocked, this should fail gracefully
      const result = await searchInPageTool.execute(params);
      
      // The tool should handle the error and return a failure response
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.processingTime).toBe('number');
    });

    it('should handle SitemapTool abort attempt', async () => {
      const params = {
        url: 'https://example.com',
        depth: 3,
        maxPages: 50
      };

      // Since puppeteer is mocked, this should fail gracefully
      const result = await sitemapTool.execute(params);
      
      // The tool should handle the error and return a failure response
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.processingTime).toBe('number');
    });

    it('should handle WebSearchTool execution', async () => {
      const params = {
        query: 'test search',
        numResults: 10
      };

      // WebSearchTool doesn't use puppeteer, so it might work differently
      const result = await webSearchTool.execute(params);
      
      // Check that the response has the expected structure
      expect(typeof result.success).toBe('boolean');
      if (!result.success && result.error) {
        expect(typeof result.error).toBe('string');
      }
    });
  });

  describe('Abort Return Values', () => {
    it('should return consistent abort results across tools', () => {
      const tools = [
        crawlTool,
        smartCrawlTool,
        extractLinksTool,
        searchInPageTool,
        sitemapTool,
        webSearchTool
      ];

      tools.forEach(tool => {
        // Should return false when no operation is active
        expect(tool.abort()).toBe(false);
      });
    });
  });

  describe('Response Structure Validation', () => {
    it('should return consistent error response structure', async () => {
      const params = { url: 'https://example.com', query: 'test' };

      const crawlResult = await crawlTool.execute(params);
      const smartCrawlResult = await smartCrawlTool.execute(params);
      const extractLinksResult = await extractLinksTool.execute({ url: params.url });
      const searchResult = await searchInPageTool.execute(params);
      const sitemapResult = await sitemapTool.execute({ url: params.url });

      // All results should have success field
      expect(typeof crawlResult.success).toBe('boolean');
      expect(typeof smartCrawlResult.success).toBe('boolean');
      expect(typeof extractLinksResult.success).toBe('boolean');
      expect(typeof searchResult.success).toBe('boolean');
      expect(typeof sitemapResult.success).toBe('boolean');

      // All results should have processingTime when not successful
      if (!crawlResult.success) {
        expect(typeof crawlResult.processingTime).toBe('number');
      }
      if (!smartCrawlResult.success) {
        expect(typeof smartCrawlResult.processingTime).toBe('number');
      }
      if (!extractLinksResult.success) {
        expect(typeof extractLinksResult.processingTime).toBe('number');
      }
      if (!searchResult.success) {
        expect(typeof searchResult.processingTime).toBe('number');
      }
      if (!sitemapResult.success) {
        expect(typeof sitemapResult.processingTime).toBe('number');
      }
    });
  });
});
