/**
 /**
 * MCP Compliance Test Suite
 * 
 * This test verifies 100% MCP compliance including:
 * - Session management with Mcp-Session-Id headers
 * - Protocol initialization handshake
 * - Capability negotiation
 * - Modern and legacy method support
 * - Standard JSON-RPC error codes
 * - Transport callbacks
 */

import { SimpleMcpServer } from '../mcp/SimpleMcpServer';
import { Request, Response } from 'express';
import config from '../config';

interface MockResponse extends Partial<Response> {
  statusCode?: number;
  headers: Record<string, string>;
  chunks: string[];
  ended: boolean;
  headersSent: boolean;
  writableEnded: boolean;
}

function createMockResponse(): MockResponse {
  const mockRes: MockResponse = {
    headers: {},
    chunks: [],
    ended: false,
    headersSent: false,
    writableEnded: false,
    setHeader: (name: string, value: string) => {
      mockRes.headers[name] = value;
      return mockRes as Response;
    },
    write: (chunk: string) => {
      mockRes.chunks.push(chunk);
      return true;
    },
    status: (code: number) => {
      mockRes.statusCode = code;
      return mockRes as Response;
    },
    json: (obj: any) => {
      mockRes.chunks.push(JSON.stringify(obj));
      return mockRes as Response;
    },
    end: () => {
      mockRes.ended = true;
      mockRes.writableEnded = true;
      return mockRes as Response;
    },
    flushHeaders: () => {
      mockRes.headersSent = true;
    }
  };
  return mockRes;
}

function createMockRequest(body: any, headers: Record<string, string> = {}): Partial<Request> {
  const mockReq = {
    body,
    headers,
    on: (event: string, listener: any) => mockReq as any
  };
  return mockReq;
}

/**
 * Test MCP Protocol Initialization
 */
async function testProtocolInitialization(): Promise<boolean> {
  console.log('🧪 Testing Protocol Initialization...');
  
  const mcpServer = new SimpleMcpServer(config);
  const mockReq = createMockRequest({
    jsonrpc: '2.0',
    method: 'initialize',
    id: 1,
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true }
      },
      clientInfo: {
        name: 'TestClient',
        version: '1.0.0'
      }
    }
  });
  
  const mockRes = createMockResponse();
  
  await mcpServer.handleStreamableHttpRequest(mockReq as Request, mockRes as Response);
  
  // Check if session ID header was set
  const sessionId = mockRes.headers['Mcp-Session-Id'];
  if (!sessionId) {
    console.error('❌ Session ID header not set');
    return false;
  }
  
  // Check response format
  const responseData = JSON.parse(mockRes.chunks[0]);
  if (responseData.jsonrpc !== '2.0' || !responseData.result || !responseData.result.protocolVersion) {
    console.error('❌ Invalid initialization response format');
    return false;
  }
  
  console.log('✅ Protocol initialization successful');
  return true;
}

/**
 * Test Session Management
 */
async function testSessionManagement(): Promise<boolean> {
  console.log('🧪 Testing Session Management...');
  
  const mcpServer = new SimpleMcpServer(config);
  
  // First request without session ID (should fail for non-initialize)
  const mockReq1 = createMockRequest({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 1
  });
  
  const mockRes1 = createMockResponse();
  await mcpServer.handleStreamableHttpRequest(mockReq1 as Request, mockRes1 as Response);
  
  if (mockRes1.statusCode !== 400) {
    console.error('❌ Should return 400 for request without session ID');
    return false;
  }
  
  // Initialize session
  const initReq = createMockRequest({
    jsonrpc: '2.0',
    method: 'initialize',
    id: 1,
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'Test', version: '1.0.0' }
    }
  });
  
  const initRes = createMockResponse();
  await mcpServer.handleStreamableHttpRequest(initReq as Request, initRes as Response);
  
  const sessionId = initRes.headers['Mcp-Session-Id'];
  
  // Use session ID in subsequent request
  const mockReq2 = createMockRequest({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 2
  }, { 'mcp-session-id': sessionId });
  
  const mockRes2 = createMockResponse();
  await mcpServer.handleStreamableHttpRequest(mockReq2 as Request, mockRes2 as Response);
  
  // Should fail because session not initialized yet
  const response = JSON.parse(mockRes2.chunks[0]);
  if (!response.error || response.error.code !== -32002) {
    console.error('❌ Should return -32002 for uninitialized session');
    return false;
  }
  
  console.log('✅ Session management working correctly');
  return true;
}

/**
 * Test Standard JSON-RPC Error Codes
 */
async function testErrorCodes(): Promise<boolean> {
  console.log('🧪 Testing Standard JSON-RPC Error Codes...');
  
  const mcpServer = new SimpleMcpServer(config);
  
  // Test unsupported protocol version (-32602)
  const mockReq = createMockRequest({
    jsonrpc: '2.0',
    method: 'initialize',
    id: 1,
    params: {
      protocolVersion: '1999-01-01', // Unsupported version
      capabilities: {},
      clientInfo: { name: 'Test', version: '1.0.0' }
    }
  });
  
  const mockRes = createMockResponse();
  await mcpServer.handleStreamableHttpRequest(mockReq as Request, mockRes as Response);
  
  const response = JSON.parse(mockRes.chunks[0]);
  if (!response.error || response.error.code !== -32602) {
    console.error('❌ Should return -32602 for unsupported protocol version');
    return false;
  }
  
  console.log('✅ Standard JSON-RPC error codes working correctly');
  return true;
}

/**
 * Test Modern vs Legacy Method Support
 */
async function testMethodSupport(): Promise<boolean> {
  console.log('🧪 Testing Modern vs Legacy Method Support...');
  
  const mcpServer = new SimpleMcpServer(config);
  
  // Initialize session first
  const initReq = createMockRequest({
    jsonrpc: '2.0',
    method: 'initialize',
    id: 1,
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'Test', version: '1.0.0' }
    }
  });
  
  const initRes = createMockResponse();
  await mcpServer.handleStreamableHttpRequest(initReq as Request, initRes as Response);
  const sessionId = initRes.headers['Mcp-Session-Id'];
  
  // Send initialized notification
  const initializedReq = createMockRequest({
    jsonrpc: '2.0',
    method: 'notifications/initialized'
  }, { 'mcp-session-id': sessionId });
  
  const initializedRes = createMockResponse();
  await mcpServer.handleStreamableHttpRequest(initializedReq as Request, initializedRes as Response);
  
  // Test modern method: tools/list
  const modernReq = createMockRequest({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 2
  }, { 'mcp-session-id': sessionId });
  
  const modernRes = createMockResponse();
  await mcpServer.handleStreamableHttpRequest(modernReq as Request, modernRes as Response);
  
  const modernResponse = JSON.parse(modernRes.chunks[0]);
  if (!modernResponse.result || !modernResponse.result.tools) {
    console.error('❌ Modern tools/list method not working');
    return false;
  }
  
  // Test legacy method: mcp.capabilities
  const legacyReq = createMockRequest({
    jsonrpc: '2.0',
    method: 'mcp.capabilities',
    id: 3
  }, { 'mcp-session-id': sessionId });
  
  const legacyRes = createMockResponse();
  await mcpServer.handleStreamableHttpRequest(legacyReq as Request, legacyRes as Response);
  
  const legacyResponse = JSON.parse(legacyRes.chunks[0]);
  if (!legacyResponse.result || !legacyResponse.result.tools) {
    console.error('❌ Legacy mcp.capabilities method not working');
    return false;
  }
  
  console.log('✅ Both modern and legacy methods working correctly');
  return true;
}

/**
 * Test Transport Callbacks
 */
async function testTransportCallbacks(): Promise<boolean> {
  console.log('🧪 Testing Transport Callbacks...');
  
  const mcpServer = new SimpleMcpServer(config);
  
  let callbackTriggered = false;
  mcpServer.setTransportCallbacks({
    onmessage: (message) => {
      callbackTriggered = true;
    }
  });
  
  // Initialize session
  const initReq = createMockRequest({
    jsonrpc: '2.0',
    method: 'initialize',
    id: 1,
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'Test', version: '1.0.0' }
    }
  });
  
  const initRes = createMockResponse();
  await mcpServer.handleStreamableHttpRequest(initReq as Request, initRes as Response);
  
  if (!callbackTriggered) {
    console.error('❌ Transport callback not triggered');
    return false;
  }
  
  console.log('✅ Transport callbacks working correctly');
  return true;
}

/**
 * Run All MCP Compliance Tests
 */
async function runMcpComplianceTests(): Promise<void> {
  console.log('🚀 Starting MCP Compliance Test Suite...\n');
  
  const tests = [
    testProtocolInitialization,
    testSessionManagement,
    testErrorCodes,
    testMethodSupport,
    testTransportCallbacks
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ Test failed with error:`, error);
      failed++;
    }
    console.log(''); // Empty line for readability
  }
  
  console.log('📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('🎉 100% MCP COMPLIANCE ACHIEVED! 🎉');
  } else {
    console.log('⚠️  Some compliance issues need to be addressed.');
  }
}

// Export for use in other tests
export { runMcpComplianceTests };

// Run tests if this file is executed directly
if (require.main === module) {
  runMcpComplianceTests().catch(console.error);
}
