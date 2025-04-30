/**
 * Configuration service for managing environment variables
 * and system-wide settings
 */
export class ConfigService {
  private config: Record<string, any>;

  constructor() {
    this.config = {
      // Application settings
      port: this.getNumberEnv('PORT', 3000),
      nodeEnv: this.getStringEnv('NODE_ENV', 'development'),

      // MCP server configuration
      mcpName: this.getStringEnv('MCP_NAME', 'Crawl4AI-MCP'),
      mcpVersion: this.getStringEnv('MCP_VERSION', '1.0.0'),
      mcpDescription: this.getStringEnv('MCP_DESCRIPTION', 'MCP Server for Crawl4AI'),

      // Crawl service configuration
      crawlServiceUrl: this.getStringEnv('CRAWL_SERVICE_URL', 'http://crawl4ai-service:3000'),
      crawlDefaultMaxPages: this.getNumberEnv('CRAWL_DEFAULT_MAX_PAGES', 10),
      crawlDefaultDepth: this.getNumberEnv('CRAWL_DEFAULT_DEPTH', 3),
      crawlDefaultStrategy: this.getStringEnv('CRAWL_DEFAULT_STRATEGY', 'bfs'),
      crawlDefaultWaitTime: this.getNumberEnv('CRAWL_DEFAULT_WAIT_TIME', 1000),

      // Logging
      logLevel: this.getStringEnv('LOG_LEVEL', 'info'),

      // Rate limiting
      rateLimitWindow: this.getNumberEnv('RATE_LIMIT_WINDOW', 15 * 60 * 1000),
      rateLimitMaxRequests: this.getNumberEnv('RATE_LIMIT_MAX_REQUESTS', 100),

      // CORS
      corsOrigins: this.getArrayEnv('CORS_ORIGINS', ['*']),

      // Cache
      cacheTtl: this.getNumberEnv('CACHE_TTL', 3600),
      // Request size limit
      maxRequestSize: this.getStringEnv('MAX_REQUEST_SIZE', '10mb'),
    };
  }

  /**
   * Get a configuration value
   * @param key The configuration key
   * @param defaultValue Default to return if value is undefined
   */
  get(key: string, defaultValue?: any): any {
    const val = this.config[key];
    return val !== undefined ? val : defaultValue;
  }

  /**
   * Get a string environment variable with fallback
   * @param name Environment variable name
   * @param defaultValue Default value if not found
   * @returns The environment variable value or default
   */
  private getStringEnv(name: string, defaultValue: string): string {
    return process.env[name] || defaultValue;
  }

  /**
   * Get a number environment variable with fallback
   * @param name Environment variable name
   * @param defaultValue Default value if not found
   * @returns The environment variable as number or default
   */
  private getNumberEnv(name: string, defaultValue: number): number {
    const value = process.env[name];
    if (value === undefined) {
      return defaultValue;
    }
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Get a boolean environment variable with fallback
   * @param name Environment variable name
   * @param defaultValue Default value if not found
   * @returns The environment variable as boolean or default
   */
  private getBooleanEnv(name: string, defaultValue: boolean): boolean {
    const value = process.env[name]?.toLowerCase();
    if (value === undefined) {
      return defaultValue;
    }
    return value === 'true' || value === '1' || value === 'yes';
  }

  /**
   * Get an array environment variable with fallback
   * @param name Environment variable name
   * @param defaultValue Default value if not found
   * @returns The environment variable as string array or default
   */
  private getArrayEnv(name: string, defaultValue: string[]): string[] {
    const value = process.env[name];
    if (!value) {
      return defaultValue;
    }
    return value.split(',').map(item => item.trim());
  }

  /**
   * Get all configuration as an object
   * @returns Complete configuration object
   */
  getAll(): Record<string, any> {
    return { ...this.config };
  }
}

export default new ConfigService();