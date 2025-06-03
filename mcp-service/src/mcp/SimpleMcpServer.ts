import { Request, Response } from 'express';
import config from '../config';
import { ToolConfig, ResourceConfig } from '../types/mcp';
import { createLogger } from '../utils/logger';
import * as crypto from 'crypto';

interface SessionData {
  sessionId: string;
  protocolVersion: string;
  clientInfo?: {
    name: string;
    version: string;
  };
  serverCapabilities: {
    tools: { listChanged: boolean };
    resources: { listChanged: boolean };
    prompts?: { listChanged: boolean };
    logging?: {};
  };
  initialized: boolean;
}

interface TransportCallbacks {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: any) => void;
}

/**
 * A simple implementation of Model Context Protocol (MCP) server
 * that supports dynamic registration of tools and resources with full MCP compliance
 */
export class SimpleMcpServer {
  private tools: ToolConfig<any, any>[] = [];
  private resources: ResourceConfig[] = [];
  private logger = createLogger('SimpleMcpServer');
  private sessions = new Map<string, SessionData>();
  private readonly SUPPORTED_PROTOCOL_VERSIONS = ['2024-11-05', '2025-03-26'];
  private transportCallbacks: TransportCallbacks = {};

  constructor(config: any) {
    // No longer need to store config as a class property since we're importing it directly
  }
  
  /**
   * Register a new tool
   */
  public tool<P, R>(toolConfig: ToolConfig<P, R>): void {
    this.tools.push(toolConfig as ToolConfig<any, any>);
  }
  
  /**
   * Register a new resource
   */
  public resource(resourceConfig: ResourceConfig): void {
    this.resources.push(resourceConfig);
  }

  /**
   * Set transport callback handlers for proper MCP compliance
   */
  public setTransportCallbacks(callbacks: TransportCallbacks): void {
    this.transportCallbacks = callbacks;
  }

  /**
   * Generate a new session ID
   */
  private generateSessionId(): string {
    return crypto.randomUUID();
  }

  /**
   * Get or create session data
   */
  private getOrCreateSession(sessionId?: string): SessionData {
    if (sessionId && this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    const newSessionId = sessionId || this.generateSessionId();
    const sessionData: SessionData = {
      sessionId: newSessionId,
      protocolVersion: this.SUPPORTED_PROTOCOL_VERSIONS[0], // Default to latest
      serverCapabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
        prompts: { listChanged: true },
        logging: {}
      },
      initialized: false
    };

    this.sessions.set(newSessionId, sessionData);
    return sessionData;
  }

  /**
   * Remove session data
   */
  private removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
  
  /**
   * Handle HTTP request for the MCP SSE connection (legacy)
   */
  async handleHttpRequest(req: Request, res: Response): Promise<void> {
    try {
      this.logger.info('Handling MCP SSE request');

      // Send initial connection success message
      this.sendSseMessage(res, {
        jsonrpc: '2.0',
        result: {
          mcp: {
            name: config.get('mcpName'),
            version: config.get('mcpVersion'),
            description: config.get('mcpDescription')
          }
        },
        id: null
      });
      
      // Process the input if present
      if (req.body && req.body.jsonrpc === '2.0') {
        await this.handleJsonRpcRequest(req.body, res, 'sse');
      }

      // Set up error handling for client disconnect
      req.on('close', () => {
        this.logger.info('Client disconnected from SSE');
      });

    } catch (error) {
      this.logger.error('Error in SSE handler:', error);
      this.sendSseMessage(res, {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null
      });
    }
  }
  
  /**
   * Handle HTTP request for the MCP Streamable HTTP endpoint (modern approach) with proper session management
   */
  async handleStreamableHttpRequest(req: Request, res: Response): Promise<void> {
    try {
      this.logger.info('Handling MCP Streamable HTTP request');

      // Extract session ID from headers
      const sessionId = req.headers['mcp-session-id'] as string;
      const isInitializeRequest = req.body?.method === 'initialize';

      let session: SessionData;

      if (sessionId) {
        // Existing session
        if (!this.sessions.has(sessionId)) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Invalid session ID',
            },
            id: req.body?.id || null,
          });
          return;
        }
        session = this.sessions.get(sessionId)!;
      } else if (isInitializeRequest) {
        // New initialization request
        session = this.getOrCreateSession();
        res.setHeader('Mcp-Session-Id', session.sessionId);
      } else {
        // Request without session ID and not an initialize request
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Missing session ID for non-initialize request',
          },
          id: req.body?.id || null,
        });
        return;
      }

      // Process the input if present
      if (req.body && req.body.jsonrpc === '2.0') {
        await this.handleJsonRpcRequest(req.body, res, 'streamable', session);
      } else {
        // Send initial connection success message for non-JSON-RPC requests
        this.sendStreamableHttpMessage(res, {
          jsonrpc: '2.0',
          result: {
            mcp: {
              name: config.get('mcpName'),
              version: config.get('mcpVersion'),
              description: config.get('mcpDescription')
            }
          },
          id: null
        });
      }

      // Set up error handling for client disconnect
      req.on('close', () => {
        this.logger.info('Client disconnected from Streamable HTTP');
        if (this.transportCallbacks.onclose) {
          this.transportCallbacks.onclose();
        }
      });

    } catch (error) {
      this.logger.error('Error in Streamable HTTP handler:', error);
      if (this.transportCallbacks.onerror) {
        this.transportCallbacks.onerror(error as Error);
      }
      
      this.sendStreamableHttpMessage(res, {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null
      });
    }
  }

  /**
   * Handle JSON-RPC request with session management and proper initialization
   */
  private async handleJsonRpcRequest(request: any, res: Response, transport: 'sse' | 'streamable', session?: SessionData): Promise<void> {
    const { method, params, id } = request;
    
    this.logger.info(`Handling JSON-RPC method: ${method} via ${transport}`);
    
    try {
      switch (method) {
        case 'initialize':
          await this.handleInitializeRequest(params, res, id, transport, session);
          break;
          
        case 'notifications/initialized':
          this.handleInitializedNotification(res, transport, session);
          break;
          
        case 'mcp.capabilities':
          // Legacy method - redirect to proper capabilities
          this.handleCapabilitiesRequest(res, id, transport, session);
          break;
          
        case 'tools/list':
          this.handleListToolsRequest(res, id, transport, session);
          break;
          
        case 'tools/call':
          await this.handleCallToolRequest(params, res, id, transport, session);
          break;
          
        case 'resources/list':
          await this.handleResourceListRequest(params, res, id, transport, session);
          break;
          
        case 'resources/read':
          await this.handleResourceGetRequest(params, res, id, transport, session);
          break;
          
        // Legacy methods for backward compatibility
        case 'mcp.tool.use':
          await this.handleToolUseRequest(params, res, id, transport, session);
          break;
          
        case 'mcp.resource.list':
          await this.handleResourceListRequest(params, res, id, transport, session);
          break;
          
        case 'mcp.resource.get':
          await this.handleResourceGetRequest(params, res, id, transport, session);
          break;
          
        default:
          this.sendMessage(res, {
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: `Method not found: ${method}`,
            },
            id
          }, transport);
      }

      // Trigger message callback if set
      if (this.transportCallbacks.onmessage) {
        this.transportCallbacks.onmessage(request);
      }

    } catch (error: any) {
      this.logger.error(`Error handling JSON-RPC method ${method}:`, error);
      if (this.transportCallbacks.onerror) {
        this.transportCallbacks.onerror(error);
      }
      
      this.sendMessage(res, {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: { error: error.message }
        },
        id
      }, transport);
    }
  }

  /**
   * Handle MCP initialize request with capability negotiation
   */
  private async handleInitializeRequest(params: any, res: Response, id: string | number, transport: 'sse' | 'streamable', session?: SessionData): Promise<void> {
    const { protocolVersion, capabilities, clientInfo } = params;

    // Validate protocol version
    if (!this.SUPPORTED_PROTOCOL_VERSIONS.includes(protocolVersion)) {
      this.sendMessage(res, {
        jsonrpc: '2.0',
        error: {
          code: -32602,
          message: 'Unsupported protocol version',
          data: {
            supported: this.SUPPORTED_PROTOCOL_VERSIONS,
            requested: protocolVersion
          }
        },
        id
      }, transport);
      return;
    }

    if (session) {
      // Update session with negotiated values
      session.protocolVersion = protocolVersion;
      session.clientInfo = clientInfo;
      
      // Negotiate capabilities based on client request
      const serverCapabilities = {
        tools: { listChanged: true },
        resources: { listChanged: true },
        prompts: { listChanged: true },
        logging: {}
      };

      session.serverCapabilities = serverCapabilities;

      this.sendMessage(res, {
        jsonrpc: '2.0',
        result: {
          protocolVersion: session.protocolVersion,
          capabilities: serverCapabilities,
          serverInfo: {
            name: config.get('mcpName'),
            version: config.get('mcpVersion'),
            description: config.get('mcpDescription')
          },
          instructions: 'MCP server for web crawling capabilities. Use tools/list to see available tools and resources/list for available resources.'
        },
        id
      }, transport);
    }
  }

  /**
   * Handle initialized notification
   */
  private handleInitializedNotification(res: Response, transport: 'sse' | 'streamable', session?: SessionData): void {
    if (session) {
      session.initialized = true;
      this.logger.info(`Session ${session.sessionId} initialized successfully`);
    }
    
    // For notifications, respond with 202 Accepted (no content)
    if (transport === 'streamable') {
      res.status(202).end();
    }
  }

  /**
   * Handle tools/list request (modern MCP method)
   */
  private handleListToolsRequest(res: Response, id: string | number, transport: 'sse' | 'streamable', session?: SessionData): void {
    if (session && !session.initialized) {
      this.sendMessage(res, {
        jsonrpc: '2.0',
        error: {
          code: -32002,
          message: 'Session not initialized',
        },
        id
      }, transport);
      return;
    }

    const tools = this.tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: {
        type: 'object',
        properties: t.parameters.describe?.() || {},
        required: [] // Will be populated by parameter validation
      }
    }));
    
    this.sendMessage(res, {
      jsonrpc: '2.0',
      result: { tools },
      id
    }, transport);
  }

  /**
   * Handle tools/call request (modern MCP method)
   */
  private async handleCallToolRequest(params: any, res: Response, id: string | number, transport: 'sse' | 'streamable', session?: SessionData): Promise<void> {
    if (session && !session.initialized) {
      this.sendMessage(res, {
        jsonrpc: '2.0',
        error: {
          code: -32002,
          message: 'Session not initialized',
        },
        id
      }, transport);
      return;
    }

    const { name, arguments: toolArgs } = params;
    this.logger.info(`Tool call request for ${name}`, toolArgs);

    try {
      const tool = this.tools.find(t => t.name === name);
      if (!tool) {
        this.sendMessage(res, {
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: `Unknown tool: ${name}`,
          },
          id
        }, transport);
        return;
      }

      // Validate parameters using Joi
      const { error, value: validParams } = tool.parameters.validate(toolArgs);
      if (error) {
        this.sendMessage(res, {
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: `Invalid parameters for tool ${name}`,
            data: { details: error.details.map(d => d.message) }
          },
          id
        }, transport);
        return;
      }

      const result = await tool.execute(validParams);
      
      // Convert result to MCP format
      const mcpResult = {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          }
        ]
      };

      this.sendMessage(res, { 
        jsonrpc: '2.0', 
        result: mcpResult, 
        id 
      }, transport);
    } catch (error: any) {
      this.logger.error(`Error executing tool ${name}:`, error);
      this.sendMessage(res, {
        jsonrpc: '2.0',
        result: {
          content: [
            {
              type: 'text',
              text: `Error executing tool: ${error.message}`
            }
          ],
          isError: true
        },
        id
      }, transport);
    }
  }

  /**
   * Handle capabilities request (legacy MCP method)
   */
  private handleCapabilitiesRequest(res: Response, id: string | number, transport: 'sse' | 'streamable', session?: SessionData): void {
    if (session && !session.initialized) {
      this.sendMessage(res, {
        jsonrpc: '2.0',
        error: {
          code: -32002,
          message: 'Session not initialized',
        },
        id
      }, transport);
      return;
    }

    const tools = this.tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: {
        type: 'object',
        properties: t.parameters.describe?.() || {},
        required: [] // Will be populated by parameter validation
      }
    }));

    const capabilities = {
      tools,
      resources: this.resources.map(r => ({
        name: r.name,
        uri: r.uri
      })),
      server: {
        name: config.get('mcpName'),
        version: config.get('mcpVersion'),
        description: config.get('mcpDescription')
      }
    };
    
    this.sendMessage(res, {
      jsonrpc: '2.0',
      result: capabilities,
      id
    }, transport);
  }

  /**
   * Handle tool use request (legacy MCP method)
   */
  private async handleToolUseRequest(params: any, res: Response, id: string | number, transport: 'sse' | 'streamable', session?: SessionData): Promise<void> {
    if (session && !session.initialized) {
      this.sendMessage(res, {
        jsonrpc: '2.0',
        error: {
          code: -32002,
          message: 'Session not initialized',
        },
        id
      }, transport);
      return;
    }

    const { name, arguments: toolArgs } = params;
    this.logger.info(`Legacy tool use request for ${name}`, toolArgs);

    try {
      const tool = this.tools.find(t => t.name === name);
      if (!tool) {
        this.sendMessage(res, {
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: `Unknown tool: ${name}`,
          },
          id
        }, transport);
        return;
      }

      // Validate parameters
      const validation = tool.parameters.validate(toolArgs);
      if (validation.error) {
        this.sendMessage(res, {
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: `Invalid parameters: ${validation.error.message}`,
          },
          id
        }, transport);
        return;
      }

      // Execute tool
      const result = await tool.execute(validation.value);
      this.sendMessage(res, {
        jsonrpc: '2.0',
        result: {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result)
            }
          ]
        },
        id
      }, transport);

    } catch (error: any) {
      this.logger.error(`Error executing legacy tool ${name}:`, error);
      this.sendMessage(res, {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: { error: error.message }
        },
        id
      }, transport);
    }
  }

  /**
   * Handle resource list request
   */
  private async handleResourceListRequest(params: any, res: Response, id: string | number, transport: 'sse' | 'streamable', session?: SessionData): Promise<void> {
    this.logger.info(`Resource list request`);
    
    try {
      // List all available resources
      const resources = this.resources.map(r => ({
        uri: r.uri,
        name: r.name,
        description: `Resource: ${r.name}`,
        mimeType: "text/plain"
      }));
      
      this.sendMessage(res, { 
        jsonrpc: '2.0', 
        result: { resources }, 
        id 
      }, transport);
    } catch (error: any) {
      this.logger.error(`Error listing resources:`, error);
      this.sendMessage(res, {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: error.message || `Error listing resources`,
        },
        id
      }, transport);
    }
  }

  /**
   * Handle resource get request
   */
  private async handleResourceGetRequest(params: any, res: Response, id: string | number, transport: 'sse' | 'streamable', session?: SessionData): Promise<void> {
    const { uri } = params;
    this.logger.info(`Resource get request for ${uri}`);
    
    try {
      const resource = this.resources.find(r => r.uri === uri);
      if (!resource) throw new Error(`Resource not found at URI: ${uri}`);
      if (!resource.handlers.get) throw new Error(`Get handler not defined for URI: ${uri}`);
      
      const result = await resource.handlers.get();
      
      // Ensure result follows MCP format
      const mcpResult = {
        contents: result.contents || [
          {
            uri: uri,
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            mimeType: "text/plain"
          }
        ]
      };
      
      this.sendMessage(res, { 
        jsonrpc: '2.0', 
        result: mcpResult, 
        id 
      }, transport);
    } catch (error: any) {
      this.logger.error(`Error getting resource at ${uri}:`, error);
      this.sendMessage(res, {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: error.message || `Error getting resource at ${uri}`,
        },
        id
      }, transport);
    }
  }

  /**
   * Send message to the client using the appropriate transport
   */
  private sendMessage(res: Response, message: any, transport: 'sse' | 'streamable'): void {
    if (transport === 'sse') {
      this.sendSseMessage(res, message);
    } else {
      this.sendStreamableHttpMessage(res, message);
    }
  }

  /**
   * Send SSE message to the client (legacy transport)
   */
  private sendSseMessage(res: Response, message: any): void {
    try {
      res.write(`data: ${JSON.stringify(message)}\n\n`);
      res.flushHeaders();
    } catch (error) {
      this.logger.error('Error sending SSE message:', error);
    }
  }
  
  /**
   * Send Streamable HTTP message to the client (modern transport)
   */
  private sendStreamableHttpMessage(res: Response, message: any): void {
    try {
      // Send JSON chunk with newline to make it easier to process client-side
      res.write(JSON.stringify(message) + '\n');
      // Flush to ensure the chunk is sent immediately
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    } catch (error) {
      this.logger.error('Error sending Streamable HTTP message:', error);
    }
  }
}