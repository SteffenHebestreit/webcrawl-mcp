import { getNumberEnv, getStringEnv } from './utils';

/**
 * Application configuration settings
 */
export const appConfig = {
  port: getNumberEnv('PORT', 3001),
  nodeEnv: getStringEnv('NODE_ENV', 'development'),
  logLevel: getStringEnv('LOG_LEVEL', 'info'),
  maxRequestSize: getStringEnv('MAX_REQUEST_SIZE', '10mb'),
  cacheTtl: getNumberEnv('CACHE_TTL', 3600),  // HTTP timeout configurations for long-running operations
  serverTimeout: getNumberEnv('SERVER_TIMEOUT', 600000), // 10 minutes in milliseconds
  requestTimeout: getNumberEnv('REQUEST_TIMEOUT', 600000), // 10 minutes in milliseconds  
  keepAliveTimeout: getNumberEnv('KEEP_ALIVE_TIMEOUT', 605000), // 10 minutes 5 seconds
  headersTimeout: getNumberEnv('HEADERS_TIMEOUT', 610000), // 10 minutes 10 seconds
};