import Joi from 'joi'; // Changed from 'zod';

/**
 * MCP Server configuration options
 */
export interface McpServerOptions {
  name: string;
  version: string;
  description: string;
}

/**
 * MCP Resource configuration
 */
export interface ResourceConfig {
  name: string;
  uri: string;
  handlers: {
    list?: () => Promise<ResourceListResponse>;
    get?: () => Promise<ResourceGetResponse>;
  };
}

/**
 * MCP Tool configuration
 */
export interface ToolConfig<P, R> {
  name: string;
  parameters: Joi.Schema; // Changed from z.ZodType<P>
  returns: Joi.Schema;    // Changed from z.ZodType<R>
  execute: (params: P) => Promise<R>;
  description: string;
  parameterDescription: string;
  returnDescription: string;
}

/**
 * Response for resource list operation
 */
export interface ResourceListResponse {
  uris: string[];
}

/**
 * Content item in a resource get response
 */
export interface ResourceContentItem {
  uri: string;
  text: string;
}

/**
 * Response for resource get operation
 */
export interface ResourceGetResponse {
  contents: ResourceContentItem[];
}

/**
 * Common parameter interfaces for crawl tools
 */
export interface CrawlParams {
  url: string;
  maxPages?: number;
  depth?: number;
  strategy?: "bfs" | "dfs" | "bestFirst";
  captureNetworkTraffic?: boolean;
  captureScreenshots?: boolean;
  waitTime?: number;
}

export interface CrawlWithMarkdownParams {
  url: string;
  maxPages?: number;
  depth?: number;
  strategy?: "bfs" | "dfs" | "bestFirst";
  query?: string;
}

/**
 * Response interfaces for crawl tools
 */
export interface CrawlResponse {
  success: boolean;
  url: string;
  text: string;
  tables?: any[];
  error?: string; // Added optional error field
}

export interface CrawlWithMarkdownResponse {
  success: boolean;
  url: string;
  markdown: string;
  error?: string; // Added optional error field
}