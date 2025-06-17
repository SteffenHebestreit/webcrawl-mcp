/**
 * Unit tests for BaseTool abort functionality
 * These tests verify that the abort mechanism works correctly
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BaseTool } from '../../services/tools/BaseTool';

// Create a simple test tool that extends BaseTool
class TestTool extends BaseTool<{ delay?: number }, { success: boolean; message: string }> {
  constructor() {
    super('TestTool');
  }

  async execute(params: { delay?: number }): Promise<{ success: boolean; message: string }> {
    const signal = this.createAbortController();
    const delay = params.delay || 1000;

    try {
      // Simulate some async work
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => resolve(), delay);

        if (signal.aborted) {
          clearTimeout(timeout);
          reject(new Error('AbortError'));
          return;
        }

        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('AbortError'));
        });
      });

      return { success: true, message: 'Operation completed' };
    } catch (error: any) {
      if (error.message === 'AbortError') {
        return { success: false, message: 'Operation aborted' };
      }
      return { success: false, message: error.message };
    }
  }
}

describe('BaseTool Abort Functionality', () => {
  let testTool: TestTool;

  beforeEach(() => {
    testTool = new TestTool();
  });

  describe('Abort Controller Creation', () => {
    it('should create a new abort controller when executing', async () => {
      const executePromise = testTool.execute({ delay: 100 });
      
      // Tool should have an active abort controller during execution
      const abortResult = testTool.abort();
      expect(abortResult).toBe(true);

      const result = await executePromise;
      expect(result.success).toBe(false);
      expect(result.message).toBe('Operation aborted');
    });

    it('should return false when aborting non-active operation', () => {
      const abortResult = testTool.abort();
      expect(abortResult).toBe(false);
    });
  });

  describe('Abort Signal Propagation', () => {
    it('should abort operation when abort() is called', async () => {
      const executePromise = testTool.execute({ delay: 2000 });

      // Abort after a short delay
      setTimeout(() => {
        const abortResult = testTool.abort();
        expect(abortResult).toBe(true);
      }, 50);

      const result = await executePromise;
      expect(result.success).toBe(false);
      expect(result.message).toBe('Operation aborted');
    });

    it('should complete normally if not aborted', async () => {
      const result = await testTool.execute({ delay: 10 });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Operation completed');
    });
  });

  describe('Multiple Abort Calls', () => {
    it('should handle multiple abort calls gracefully', async () => {
      const executePromise = testTool.execute({ delay: 1000 });

      // Call abort multiple times
      const abortResult1 = testTool.abort();
      const abortResult2 = testTool.abort();
      const abortResult3 = testTool.abort();

      expect(abortResult1).toBe(true);
      expect(abortResult2).toBe(false); // No active operation to abort
      expect(abortResult3).toBe(false); // No active operation to abort

      const result = await executePromise;
      expect(result.success).toBe(false);
      expect(result.message).toBe('Operation aborted');
    });
  });

  describe('Concurrent Executions', () => {
    it('should handle concurrent executions independently', async () => {
      const tool1 = new TestTool();
      const tool2 = new TestTool();

      const executePromise1 = tool1.execute({ delay: 1000 });
      const executePromise2 = tool2.execute({ delay: 1000 });

      // Abort only the first tool
      const abortResult1 = tool1.abort();
      expect(abortResult1).toBe(true);

      const [result1, result2] = await Promise.all([executePromise1, executePromise2]);

      expect(result1.success).toBe(false);
      expect(result1.message).toBe('Operation aborted');

      expect(result2.success).toBe(true);
      expect(result2.message).toBe('Operation completed');
    });
  });

  describe('Abort Controller Cleanup', () => {
    it('should clean up abort controller after execution', async () => {
      await testTool.execute({ delay: 10 });

      // Should not be able to abort after execution is complete
      const abortResult = testTool.abort();
      expect(abortResult).toBe(false);
    });

    it('should clean up abort controller after abort', async () => {
      const executePromise = testTool.execute({ delay: 1000 });

      const abortResult1 = testTool.abort();
      expect(abortResult1).toBe(true);

      await executePromise;

      // Should not be able to abort again
      const abortResult2 = testTool.abort();
      expect(abortResult2).toBe(false);
    });
  });
});
