import config from '../config';

/**
 * Log levels ordered by severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * Maps string log level to enum value
 */
const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR
};

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  timestamp: '\x1b[90m' // Gray
};

/**
 * Get current configured log level from environment or config
 */
function getConfiguredLogLevel(): LogLevel {
  const configLevel = (config.get('logLevel') || 'info').toLowerCase();
  return LOG_LEVEL_MAP[configLevel] ?? LogLevel.INFO;
}

/**
 * Determines if a message at the given level should be logged
 */
function shouldLog(level: LogLevel): boolean {
  return level >= getConfiguredLogLevel();
}

/**
 * Formats the log message with timestamp and proper formatting
 */
function formatLogMessage(level: string, message: string, context?: any): string {
  const timestamp = new Date().toISOString();
  const levelUpper = level.toUpperCase();
  const color = COLORS[level as keyof typeof COLORS] || '';
  const logObj: any = {
    time: timestamp,
    type: levelUpper,
    color,
    message,
  };
  if (context) {
    logObj.context = context;
  }
  return JSON.stringify(logObj);
}

/**
 * Logger class with methods for different log levels
 */
export class Logger {
  private source?: string;
  
  /**
   * Create a new logger instance, optionally with a source name
   */
  constructor(source?: string) {
    this.source = source;
    this.debug = this.debug.bind(this);
    this.info = this.info.bind(this);
    this.warn = this.warn.bind(this);
    this.error = this.error.bind(this);
  }

  /**
   * Log at DEBUG level
   */
  debug(message: string, context?: any): void {
    if (shouldLog(LogLevel.DEBUG)) {
      const sourcePrefix = this.source ? `[${this.source}] ` : '';
      console.log(formatLogMessage('debug', `${sourcePrefix}${message}`, context));
    }
  }

  /**
   * Log at INFO level
   */
  info(message: string, context?: any): void {
    if (shouldLog(LogLevel.INFO)) {
      const sourcePrefix = this.source ? `[${this.source}] ` : '';
      console.log(formatLogMessage('info', `${sourcePrefix}${message}`, context));
    }
  }

  /**
   * Log at WARN level
   */
  warn(message: string, context?: any): void {
    if (shouldLog(LogLevel.WARN)) {
      const sourcePrefix = this.source ? `[${this.source}] ` : '';
      console.warn(formatLogMessage('warn', `${sourcePrefix}${message}`, context));
    }
  }

  /**
   * Log at ERROR level
   */
  error(message: string, error?: Error | any): void {
    if (shouldLog(LogLevel.ERROR)) {
      const sourcePrefix = this.source ? `[${this.source}] ` : '';
      const context = error instanceof Error ? { message: error.message, stack: error.stack } : error;
      console.error(formatLogMessage('error', `${sourcePrefix}${message}`, context));
    }
  }
}

/**
 * Create a logger for a specific module/class
 * @param source The source name for logs
 * @returns Logger instance
 */
export function createLogger(source?: string): Logger {
  return new Logger(source);
}

// Create default logger instance
export const logger = createLogger();

export default logger;