import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure log directory exists
const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Creates a named logger instance with consistent formatting
 * 
 * @param name The name/category for this logger
 * @returns A Winston logger instance
 */
export function createLogger(name: string): winston.Logger {
  // Get log level from environment or default to info
  const logLevel = process.env.LOG_LEVEL?.toLowerCase() || 'info';
  
  // Create a custom format for console output with colors
  const consoleFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      // Extract service info from meta
      const service = meta.service || 'mcp-service';
      delete meta.service;
      
      // Format other metadata if present
      const metaStr = Object.keys(meta).length 
        ? ' ' + JSON.stringify(meta)
        : '';
      
      return `${timestamp} [${level}] [${name}]: ${message} {"service":"${service}"${metaStr.length > 0 ? ',' + metaStr.substring(1) : ''}}`;
    })
  );
  
  // Create a more structured format for file logging
  const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  );

  const transports: winston.transport[] = [
    // Console transport with colorization
    new winston.transports.Console({
      format: consoleFormat
    })
  ];
  
  // Add file transport if not in test environment
  if (process.env.NODE_ENV !== 'test') {
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'mcp-service.log'),
        format: fileFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        tailable: true
      })
    );
    
    // Add error log file for error level logs
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        format: fileFormat,
        maxsize: 5 * 1024 * 1024, // 5MB
        maxFiles: 5,
        tailable: true
      })
    );
  }

  const logger = winston.createLogger({
    level: logLevel,
    defaultMeta: { service: 'mcp-service' },
    transports
  });

  return logger;
}