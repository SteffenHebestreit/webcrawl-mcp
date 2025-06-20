// Module declarations for packages without explicit type definitions or where type resolution fails

declare module 'dotenv' {
  export function config(options?: {
    path?: string;
    encoding?: string;
    debug?: boolean;
    override?: boolean;
  }): { parsed: { [key: string]: string } };
}

// For express-rate-limit types that aren't being found automatically
declare module 'express-rate-limit' {
  import { RequestHandler } from 'express';
  
  interface RateLimitOptions {
    windowMs?: number;
    max?: number;
    message?: string;
    statusCode?: number;
    headers?: boolean;
    skipFailedRequests?: boolean;
    skipSuccessfulRequests?: boolean;
    keyGenerator?: (req: any) => string;
    handler?: (req: any, res: any) => void;
    onLimitReached?: (req: any, res: any, options: RateLimitOptions) => void;
    skip?: (req: any, res: any) => boolean;
  }

  function rateLimit(options?: RateLimitOptions): RequestHandler;
  export default rateLimit;
}

// In case node-fetch types aren't being found automatically
declare module 'node-fetch' {
  export * from 'node-fetch';
  export default function fetch(
    url: string | Request,
    init?: RequestInit
  ): Promise<Response>;
}