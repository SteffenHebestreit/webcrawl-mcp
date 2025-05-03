import { getNumberEnv, getStringEnv } from './utils';

/**
 * Web crawling configuration settings
 */
export const crawlConfig = {
  crawlDefaultMaxPages: getNumberEnv('CRAWL_DEFAULT_MAX_PAGES', 10),
  crawlDefaultDepth: getNumberEnv('CRAWL_DEFAULT_DEPTH', 3),
  crawlDefaultStrategy: getStringEnv('CRAWL_DEFAULT_STRATEGY', 'bfs'),
  crawlDefaultWaitTime: getNumberEnv('CRAWL_DEFAULT_WAIT_TIME', 1000),
};