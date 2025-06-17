/**
 * Example client demonstrating how to use the abort functionality
 * This shows both MCP protocol and REST API usage
 */
import { WebSocket } from 'ws';
import fetch from 'node-fetch';

// Type definitions for MCP protocol
interface McpRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

interface McpResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface ToolExecutionTracker {
  toolId: string;
  method: string;
  params: any;
  startTime: number;
  abortController?: AbortController;
}

/**
 * MCP Client with abort support
 */
export class McpClientWithAbort {
  private ws: WebSocket | null = null;
  private requestId = 1;
  private pendingRequests = new Map<string | number, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    tracker?: ToolExecutionTracker;
  }>();
  private activeExecutions = new Map<string, ToolExecutionTracker>();

  constructor(private serverUrl: string) {}

  /**
   * Connect to the MCP server via WebSocket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.on('open', () => {
        console.log('Connected to MCP server');
        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const response: McpResponse = JSON.parse(data.toString());
          this.handleResponse(response);
        } catch (error) {
          console.error('Failed to parse response:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('Disconnected from MCP server');
        this.cleanup();
      });
    });
  }

  /**
   * Send a request to the MCP server
   */
  private sendRequest(method: string, params?: any): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to MCP server');
    }

    const id = this.requestId++;
    const request: McpRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      // Track the request
      this.pendingRequests.set(id, { resolve, reject });

      // Send the request
      this.ws!.send(JSON.stringify(request));

      // Set a timeout for the request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Handle responses from the MCP server
   */
  private handleResponse(response: McpResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      console.warn('Received response for unknown request:', response.id);
      return;
    }

    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(`MCP Error: ${response.error.message}`));
    } else {
      // Check if this is a tool execution response with toolId
      if (response.result && response.result.toolId && pending.tracker) {
        pending.tracker.toolId = response.result.toolId;
        this.activeExecutions.set(response.result.toolId, pending.tracker);
      }

      pending.resolve(response.result);
    }
  }

  /**
   * Execute a tool with abort support
   */
  async executeTool(toolName: string, params: any): Promise<any> {
    const startTime = Date.now();
    const tracker: ToolExecutionTracker = {
      toolId: '', // Will be set when response comes back
      method: `tools/${toolName}`,
      params,
      startTime,
      abortController: new AbortController()
    };

    try {
      const result = await this.sendRequest(`tools/${toolName}`, params);
      
      // Remove from active executions when completed
      if (tracker.toolId) {
        this.activeExecutions.delete(tracker.toolId);
      }

      return result;
    } catch (error) {
      // Clean up on error
      if (tracker.toolId) {
        this.activeExecutions.delete(tracker.toolId);
      }
      throw error;
    }
  }

  /**
   * Abort a tool execution
   */
  async abortTool(toolId: string): Promise<boolean> {
    try {
      await this.sendRequest('tools/abort', { toolId });
      
      // Remove from active executions
      this.activeExecutions.delete(toolId);
      
      return true;
    } catch (error) {
      console.error('Failed to abort tool:', error);
      return false;
    }
  }

  /**
   * Abort all active tool executions
   */
  async abortAllTools(): Promise<{ success: number; failed: number }> {
    const activeToolIds = Array.from(this.activeExecutions.keys());
    let success = 0;
    let failed = 0;

    for (const toolId of activeToolIds) {
      try {
        await this.abortTool(toolId);
        success++;
      } catch (error) {
        console.error(`Failed to abort tool ${toolId}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Get list of active tool executions
   */
  getActiveExecutions(): ToolExecutionTracker[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.pendingRequests.clear();
    this.activeExecutions.clear();
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.cleanup();
  }
}

/**
 * REST API Client with abort support
 */
export class RestClientWithAbort {
  private activeRequests = new Map<string, AbortController>();

  constructor(private baseUrl: string) {}

  /**
   * Execute a tool via REST API with abort support
   */
  async executeTool(toolName: string, params: any): Promise<any> {
    const abortController = new AbortController();
    const requestId = `${toolName}-${Date.now()}-${Math.random()}`;
    
    this.activeRequests.set(requestId, abortController);

    try {
      const response = await fetch(`${this.baseUrl}/tools/${toolName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.activeRequests.delete(requestId);
      return result;    } catch (error) {
      this.activeRequests.delete(requestId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request was aborted');
      }
      throw error;
    }
  }

  /**
   * Abort a tool execution via REST API
   */
  async abortTool(toolId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/tools/abort/${toolId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to abort tool via REST API:', error);
      return false;
    }
  }

  /**
   * Abort a local request by request ID
   */
  abortRequest(requestId: string): boolean {
    const abortController = this.activeRequests.get(requestId);
    if (abortController) {
      abortController.abort();
      this.activeRequests.delete(requestId);
      return true;
    }
    return false;
  }

  /**
   * Abort all active requests
   */
  abortAllRequests(): number {
    let aborted = 0;
    for (const [requestId, abortController] of this.activeRequests) {
      abortController.abort();
      aborted++;
    }
    this.activeRequests.clear();
    return aborted;
  }

  /**
   * Get number of active requests
   */
  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }
}

/**
 * Example usage of the abort functionality
 */
async function demonstrateAbortFunctionality() {
  console.log('=== MCP Client Abort Demonstration ===');

  // Example 1: MCP Protocol with abort
  const mcpClient = new McpClientWithAbort('ws://localhost:3000/mcp');
  
  try {
    await mcpClient.connect();
    console.log('Connected to MCP server');

    // Start a long-running crawl operation
    console.log('Starting crawl operation...');
    const crawlPromise = mcpClient.executeTool('crawl', {
      url: 'https://example.com',
      query: 'test query'
    });

    // Simulate aborting after 2 seconds
    setTimeout(async () => {
      console.log('Aborting crawl operation...');
      const activeExecutions = mcpClient.getActiveExecutions();
      if (activeExecutions.length > 0) {
        const success = await mcpClient.abortTool(activeExecutions[0].toolId);
        console.log('Abort result:', success);
      }
    }, 2000);

    // Wait for the result
    const result = await crawlPromise;
    console.log('Crawl result:', result);

  } catch (error) {
    console.error('MCP Error:', error);
  } finally {
    await mcpClient.disconnect();
  }

  console.log('\\n=== REST API Abort Demonstration ===');

  // Example 2: REST API with abort
  const restClient = new RestClientWithAbort('http://localhost:3000');

  try {
    // Start multiple operations
    console.log('Starting multiple operations...');
    
    const crawlPromise = restClient.executeTool('crawl', {
      url: 'https://example.com',
      query: 'test'
    });

    const smartCrawlPromise = restClient.executeTool('smartCrawl', {
      url: 'https://example.com',
      query: 'test',
      maxPages: 10
    });

    // Abort all requests after 3 seconds
    setTimeout(() => {
      console.log('Aborting all requests...');
      const aborted = restClient.abortAllRequests();
      console.log(`Aborted ${aborted} requests`);
    }, 3000);

    // Wait for results
    const results = await Promise.allSettled([crawlPromise, smartCrawlPromise]);
    console.log('Results:', results);

  } catch (error) {
    console.error('REST Error:', error);
  }
}

// Example of handling abort in a user interface context
export class UIToolExecutor {
  private mcpClient: McpClientWithAbort;
  private restClient: RestClientWithAbort;
  private activeOperations = new Map<string, string>(); // operationId -> toolId

  constructor(mcpUrl: string, restUrl: string) {
    this.mcpClient = new McpClientWithAbort(mcpUrl);
    this.restClient = new RestClientWithAbort(restUrl);
  }

  /**
   * Execute a tool operation that can be cancelled by the user
   */
  async executeWithUI(
    operationId: string,
    toolName: string, 
    params: any,
    onProgress?: (progress: string) => void,
    onCancel?: () => void
  ): Promise<any> {
    try {
      onProgress?.('Starting operation...');
      
      // Connect if needed
      await this.mcpClient.connect();
      
      onProgress?.('Executing tool...');
      
      // Start the operation
      const resultPromise = this.mcpClient.executeTool(toolName, params);
      
      // Store operation for potential cancellation
      // In real implementation, you'd get the toolId from the initial response
      const toolId = `${operationId}-${Date.now()}`;
      this.activeOperations.set(operationId, toolId);
      
      // Wait for result
      const result = await resultPromise;
      
      // Clean up
      this.activeOperations.delete(operationId);
      onProgress?.('Operation completed');
      
      return result;
        } catch (error) {
      this.activeOperations.delete(operationId);
      
      if (error instanceof Error && error.message.includes('aborted')) {
        onProgress?.('Operation cancelled by user');
        onCancel?.();
      } else {
        onProgress?.(`Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      throw error;
    }
  }

  /**
   * Cancel an operation by operation ID
   */
  async cancelOperation(operationId: string): Promise<boolean> {
    const toolId = this.activeOperations.get(operationId);
    if (toolId) {
      const success = await this.mcpClient.abortTool(toolId);
      if (success) {
        this.activeOperations.delete(operationId);
      }
      return success;
    }
    return false;
  }

  /**
   * Cancel all active operations
   */
  async cancelAllOperations(): Promise<void> {
    const results = await this.mcpClient.abortAllTools();
    console.log(`Cancelled ${results.success} operations, ${results.failed} failed`);
    this.activeOperations.clear();
  }

  /**
   * Get list of active operations
   */
  getActiveOperations(): string[] {
    return Array.from(this.activeOperations.keys());
  }

  /**
   * Cleanup and disconnect
   */
  async cleanup(): Promise<void> {
    await this.cancelAllOperations();
    await this.mcpClient.disconnect();
  }
}

// Run the demonstration if this file is executed directly
if (require.main === module) {
  demonstrateAbortFunctionality().catch(console.error);
}
