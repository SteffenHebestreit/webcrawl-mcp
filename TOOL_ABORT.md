# Tool Execution Abort Functionality

## Overview

The Webcrawl-MCP service now supports aborting tool executions. This is useful when a frontend client cancels a request or disconnects, allowing the server to cleanly terminate any ongoing tool executions.

## How it Works

When a tool execution is started, the server generates a unique tool ID and tracks the execution. The tool ID is returned in the response metadata. This ID can be used to abort the execution at any time.

### MCP Protocol Method

The MCP protocol now supports a new method `tools/abort` for aborting tool executions:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/abort",
  "params": {
    "toolId": "crawl-1623456789-abc123def"
  },
  "id": "request-id-1"
}
```

Response:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "success": true,
    "message": "Successfully aborted tool execution: crawl-1623456789-abc123def"
  },
  "id": "request-id-1"
}
```

### REST API Endpoint

For non-MCP clients, the service also provides a REST API endpoint for aborting tool executions:

```
POST /api/tools/abort/:toolId
```

Example:
```
POST /api/tools/abort/crawl-1623456789-abc123def
```

Response:
```json
{
  "success": true,
  "message": "Successfully aborted tool execution: crawl-1623456789-abc123def"
}
```

## Implementation Details

- When a tool execution is started, a unique ID is generated and returned in the response metadata
- The server tracks all active tool executions with their IDs
- When an abort request is received, the server uses the tool ID to find and abort the execution
- The BaseTool class has been extended with abort functionality that all tool implementations inherit
- AbortController/AbortSignal is used to propagate the abort signal through asynchronous operations

## Usage Workflow

1. Client starts a tool execution using the MCP protocol or REST API
2. Server returns a response with a tool ID in the metadata
3. If the client needs to abort the execution, it sends an abort request with the tool ID
4. Server aborts the execution and returns a success/failure response

## Abort Scenarios

Tool executions may be aborted in the following scenarios:

1. **Client Request**: The client explicitly requests to abort a tool execution
2. **Client Disconnect**: The client disconnects from the server (browser closes, network error, etc.)
3. **Request Timeout**: The server times out the request according to its configuration
4. **Server Shutdown**: The server is shutting down and needs to terminate all active executions

## Example: Aborting a Web Crawl

```javascript
// Step 1: Start a web crawl
const response = await fetch('/mcp/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'crawl',
      arguments: {
        url: 'https://example.com',
        query: 'Extract content',
        maxPages: 10
      }
    },
    id: 'request-1'
  })
});

const result = await response.json();
const toolId = result.result.metadata.toolId;

// Step 2: Abort the crawl if needed
const abortResponse = await fetch('/mcp/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/abort',
    params: {
      toolId: toolId
    },
    id: 'request-2'
  })
});

const abortResult = await abortResponse.json();
console.log(abortResult); // { success: true, message: "Successfully aborted..." }
```

## Testing

Integration tests have been added to verify the abort functionality works correctly:

### Running Tests

```bash
# Run all tests
npm test

# Run only abort-related tests
npm run test:abort

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode for development
npm run test:watch
```

### Test Structure

- `src/tests/tools/abort.integration.test.ts` - Integration tests for tool abort functionality
- `src/tests/setup.ts` - Test configuration and global setup
- `jest.config.json` - Jest configuration

The tests verify:
- Tools can be aborted during execution
- Abort signals are properly propagated
- Resources are cleaned up correctly
- Multiple tools can be managed independently
- Error handling for abort operations

## Client Implementation Examples

### MCP Protocol Client

```typescript
import { McpClientWithAbort } from './examples/abort-client-example';

const client = new McpClientWithAbort('ws://localhost:3000/mcp');
await client.connect();

// Start a tool execution
const crawlPromise = client.executeTool('crawl', {
  url: 'https://example.com',
  query: 'test'
});

// Abort if needed
const activeExecutions = client.getActiveExecutions();
if (activeExecutions.length > 0) {
  await client.abortTool(activeExecutions[0].toolId);
}
```

### REST API Client

```typescript
import { RestClientWithAbort } from './examples/abort-client-example';

const client = new RestClientWithAbort('http://localhost:3000');

// Start operation with abort controller
const crawlPromise = client.executeTool('crawl', { url: 'https://example.com' });

// Abort all active requests
client.abortAllRequests();
```

### UI Integration Example

```typescript
import { UIToolExecutor } from './examples/abort-client-example';

const executor = new UIToolExecutor('ws://localhost:3000/mcp', 'http://localhost:3000');

// Execute with progress callback and cancellation support
await executor.executeWithUI(
  'operation-1',
  'crawl',
  { url: 'https://example.com' },
  (progress) => console.log(progress),
  () => console.log('Cancelled by user')
);

// Cancel specific operation
await executor.cancelOperation('operation-1');
```

## Browser Error Handling

When implementing abort functionality in browser environments, proper cleanup is essential to prevent memory leaks:

```typescript
// Example browser implementation
class BrowserToolManager {
  private activeRequests = new Map<string, AbortController>();

  async executeTool(toolName: string, params: any): Promise<any> {
    const abortController = new AbortController();
    const requestId = this.generateRequestId();
    
    this.activeRequests.set(requestId, abortController);

    try {
      // Handle page unload - abort all requests
      const onUnload = () => this.abortAllRequests();
      window.addEventListener('beforeunload', onUnload);

      const result = await this.makeRequest(toolName, params, abortController.signal);
      
      // Cleanup
      this.activeRequests.delete(requestId);
      window.removeEventListener('beforeunload', onUnload);
      
      return result;
    } catch (error) {
      this.activeRequests.delete(requestId);
      throw error;
    }
  }

  abortAllRequests(): void {
    for (const [requestId, controller] of this.activeRequests) {
      controller.abort();
    }
    this.activeRequests.clear();
  }
}
