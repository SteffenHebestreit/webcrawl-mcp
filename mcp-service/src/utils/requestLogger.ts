import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from './logger';

const requestIdSymbol = Symbol('requestId');

declare global {
  namespace Express {
    interface Request {
      [requestIdSymbol]?: string;
    }
  }
}

function getOrCreateRequestId(req: Request): string {
  const existingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  if (existingId && typeof existingId === 'string') {
    return existingId;
  }
  return uuidv4();
}

export function getRequestId(req: Request): string | undefined {
  return req[requestIdSymbol];
}

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = getOrCreateRequestId(req);
  req[requestIdSymbol] = requestId;
  res.setHeader('X-Request-ID', requestId);

  const startTime = Date.now();
  const method = req.method;
  const url = req.originalUrl || req.url;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  logger.info(`[${requestId}] ${method} ${url} from ${ip}`);
  logger.debug(`[${requestId}] Headers: ${JSON.stringify(req.headers)}`);

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    let logFn = logger.info;
    if (statusCode >= 500) {
      logFn = logger.error;
    } else if (statusCode >= 400) {
      logFn = logger.warn;
    }
    logFn(`[${requestId}] ${method} ${url} completed with ${statusCode} in ${duration}ms`);
  });

  next();
}

export function errorLoggerMiddleware(err: Error, req: Request, res: Response, next: NextFunction): void {
  const requestId = getRequestId(req) || 'unknown';
  logger.error(`[${requestId}] Error processing request: ${err.message}`);
  logger.debug(`[${requestId}] Error stack: ${err.stack}`);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: 'Internal server error',
    requestId
  });
}