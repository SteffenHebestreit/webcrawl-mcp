import dotenv from 'dotenv';
import { appConfig } from './appConfig';
import { mcpConfig } from './mcpConfig';
import { securityConfig } from './securityConfig';
import { crawlConfig } from './crawlConfig';

// Load environment variables from .env file
dotenv.config();

/**
 * Combined configuration object that merges all config modules
 */
export const config = {
  ...appConfig,
  ...mcpConfig,
  ...securityConfig,
  ...crawlConfig,

  /**
   * Get a configuration value
   * @param key The configuration key
   * @param defaultValue Default to return if value is undefined
   */
  get: function(key: string, defaultValue?: any): any {
    const val = this[key as keyof typeof this];
    return val !== undefined ? val : defaultValue;
  },

  /**
   * Get all configuration as an object
   * @returns Complete configuration object
   */
  getAll: function(): Record<string, any> {
    // Create a new object with only the configuration properties, 
    // excluding the function properties
    const configCopy: Record<string, any> = {};
    
    // Copy all properties from the config modules
    Object.assign(configCopy, appConfig, mcpConfig, securityConfig, crawlConfig);
    
    return configCopy;
  }
};

export default config;