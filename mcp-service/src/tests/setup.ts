/**
 * Jest test setup file
 * Sets up global test configuration and mocks
 */
import { jest, beforeEach, afterEach } from '@jest/globals';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console to reduce noise in tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;
}

// Setup global test utilities
(global as any).TEST_TIMEOUT = 5000;
(global as any).ABORT_DELAY = 100;

// Mock timers for faster tests
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});
