import { getArrayEnv, getNumberEnv } from './utils';

/**
 * Security configuration settings for the application
 */
export const securityConfig = {
  // Rate limiting - Relaxed for development/testing
  rateLimitWindow: getNumberEnv('RATE_LIMIT_WINDOW', 1 * 60 * 1000), // 1 minute window instead of 15
  rateLimitMaxRequests: getNumberEnv('RATE_LIMIT_MAX_REQUESTS', 1000), // 1000 requests instead of 100

  // CORS
  corsOrigins: getArrayEnv('CORS_ORIGINS', ['*']),
};