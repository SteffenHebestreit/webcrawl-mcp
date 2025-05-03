import { getNumberEnv, getStringEnv } from './utils';

/**
 * Application configuration settings
 */
export const appConfig = {
  port: getNumberEnv('PORT', 3000),
  nodeEnv: getStringEnv('NODE_ENV', 'development'),
  logLevel: getStringEnv('LOG_LEVEL', 'info'),
  maxRequestSize: getStringEnv('MAX_REQUEST_SIZE', '10mb'),
  cacheTtl: getNumberEnv('CACHE_TTL', 3600),
};