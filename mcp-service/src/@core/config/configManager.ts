import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createLogger } from '../utils/logger.js';

// Load environment variables from .env file
dotenv.config();

const logger = createLogger('ConfigManager');

/**
 * ConfigManager is responsible for loading and managing all application configurations
 * It supports loading from both environment variables and config files
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: Record<string, any> = {};
  private configFiles: string[] = [];

  private constructor() {
    // This is a singleton, use getInstance() instead
  }

  /**
   * Get the singleton instance of ConfigManager
   */
  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Initialize the configuration manager by loading from environment variables
   * and optionally from specified config files
   * 
   * @param configFiles Optional paths to JSON/JS configuration files
   */
  public async init(configFiles: string[] = []): Promise<void> {
    this.configFiles = configFiles;
    this.loadFromEnv();
    await this.loadFromFiles();
    
    logger.info('Configuration initialized');
    logger.debug('Config keys loaded:', Object.keys(this.config).join(', '));
  }
  
  /**
   * Load configuration from environment variables
   * Environment variables take precedence over config files
   */
  private loadFromEnv(): void {
    logger.info('Loading configuration from environment variables');
    
    // Basic application config
    this.config.port = parseInt(process.env.PORT || '3000', 10);
    this.config.environment = process.env.NODE_ENV || 'development';
    this.config.logLevel = process.env.LOG_LEVEL || 'info';
    
    // MCP specific config
    this.config.mcpName = process.env.MCP_NAME || 'Template-MCP';
    this.config.mcpVersion = process.env.MCP_VERSION || '1.0.0';
    this.config.mcpDescription = process.env.MCP_DESCRIPTION || 'Template MCP Server';
    
    // Crawl default config
    this.config.crawlDefaultMaxPages = parseInt(process.env.CRAWL_DEFAULT_MAX_PAGES || '10', 10);
    this.config.crawlDefaultDepth = parseInt(process.env.CRAWL_DEFAULT_DEPTH || '3', 10);
    this.config.crawlDefaultStrategy = process.env.CRAWL_DEFAULT_STRATEGY || 'bfs';
    this.config.crawlDefaultWaitTime = parseInt(process.env.CRAWL_DEFAULT_WAIT_TIME || '1000', 10);
    
    // Security config
    this.config.corsEnabled = process.env.CORS_ENABLED === 'true';
    this.config.corsOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'];
    this.config.rateLimit = parseInt(process.env.RATE_LIMIT || '100', 10);
    this.config.apiKey = process.env.API_KEY;

    // Tool config - dynamically loaded from env vars
    this.loadToolConfigFromEnv();
  }

  /**
   * Load tool configuration from environment variables
   * Environment variables like TOOL_CRAWL_ENABLED=true will enable/disable tools
   */
  private loadToolConfigFromEnv(): void {
    this.config.tools = this.config.tools || {};
    
    // Look for environment variables that start with TOOL_
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('TOOL_')) {
        // Parse key format: TOOL_NAME_PROPERTY
        const parts = key.split('_');
        if (parts.length >= 3) {
          const toolName = parts[1].toLowerCase();
          const propertyName = parts.slice(2).join('_').toLowerCase();
          
          // Initialize tool config if it doesn't exist
          if (!this.config.tools[toolName]) {
            this.config.tools[toolName] = {};
          }
          
          // Set the property on the tool config
          let value: any = process.env[key];
          
          // Convert to appropriate types
          if (value === 'true' || value === 'false') {
            value = value === 'true';
          } else if (!isNaN(Number(value)) && value !== '') {
            value = Number(value);
          }
          
          this.config.tools[toolName][propertyName] = value;
          
          logger.debug(`Tool config set: tools.${toolName}.${propertyName} = ${value}`);
        }
      }
    });
  }
  
  /**
   * Load configuration from specified config files
   * Files are loaded in order, with later files overriding earlier ones
   * Environment variables take precedence over all config files
   */
  private async loadFromFiles(): Promise<void> {
    for (const file of this.configFiles) {
      try {
        logger.info(`Loading configuration from file: ${file}`);
        let fileConfig: Record<string, any> = {};
        
        if (file.endsWith('.json')) {
          const content = fs.readFileSync(file, 'utf8');
          fileConfig = JSON.parse(content);
        } else if (file.endsWith('.js')) {
          // For .js files, use dynamic import instead of require
          const fullPath = path.resolve(file);
          const importedModule = await import(fullPath);
          
          // Handle both default exports and named exports
          fileConfig = importedModule.default || importedModule;
        } else {
          logger.warn(`Unsupported config file format: ${file}`);
          continue;
        }
        
        // Merge file config with main config
        this.mergeConfigs(fileConfig);
        
      } catch (error) {
        logger.error(`Error loading config file ${file}:`, error);
      }
    }
  }
  
  /**
   * Recursively merge source object into target object
   */
  private mergeConfigs(source: Record<string, any>, target: Record<string, any> = this.config): void {
    for (const key in source) {
      // Only merge if property doesn't already exist from environment variables
      if (!Object.prototype.hasOwnProperty.call(target, key) || 
          (typeof source[key] === 'object' && !Array.isArray(source[key]))) {
        
        if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
          target[key] = target[key] || {};
          this.mergeConfigs(source[key], target[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
  }
  
  /**
   * Get a configuration value by key
   * Supports dot notation for nested properties
   * 
   * @param key Configuration key (supports dot notation, e.g. 'server.port')
   * @param defaultValue Optional default value if key doesn't exist
   */
  public get<T>(key: string, defaultValue?: T): T {
    const parts = key.split('.');
    let value: any = this.config;
    
    for (const part of parts) {
      if (value === undefined || value === null) break;
      value = value[part];
    }
    
    return (value !== undefined && value !== null) ? value : defaultValue as T;
  }
  
  /**
   * Set a configuration value
   * Supports dot notation for nested properties
   * 
   * @param key Configuration key (supports dot notation)
   * @param value Value to set
   */
  public set<T>(key: string, value: T): void {
    const parts = key.split('.');
    let current = this.config;
    
    // Navigate to the correct level, creating objects as needed
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    // Set the value on the last part
    current[parts[parts.length - 1]] = value;
    logger.debug(`Config value set: ${key} = ${value}`);
  }
  
  /**
   * Get all configuration as an object
   */
  public getAll(): Record<string, any> {
    return { ...this.config };
  }
}

// Export a singleton instance
const configManager = ConfigManager.getInstance();
export default configManager;