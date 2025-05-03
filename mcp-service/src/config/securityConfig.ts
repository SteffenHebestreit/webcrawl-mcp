import { getArrayEnv, getNumberEnv } from './utils';

/**
 * Security configuration settings for the application
 */
export const securityConfig = {
  // Rate limiting
  rateLimitWindow: getNumberEnv('RATE_LIMIT_WINDOW', 15 * 60 * 1000),
  rateLimitMaxRequests: getNumberEnv('RATE_LIMIT_MAX_REQUESTS', 100),

  // CORS
  corsOrigins: getArrayEnv('CORS_ORIGINS', ['*']),
};