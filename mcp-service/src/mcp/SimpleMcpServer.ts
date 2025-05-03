import { Request, Response } from 'express';
import config from '../config';
import { ToolConfig, ResourceConfig } from '../types/mcp';
import { createLogger } from '../utils/logger';

/**
 * A simple implementation of Model Context Protocol (MCP) server
 * that supports dynamic registration of tools and resources
 */
export class SimpleMcpServer {
  private tools: ToolConfig<any, any>[] = [];
  private resources: ResourceConfig[] = [];
  private logger = createLogger('SimpleMcpServer');

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
   * Handle HTTP request for the MCP Streamable HTTP endpoint (modern approach)
   */
  async handleStreamableHttpRequest(req: Request, res: Response): Promise<void> {
    try {
      this.logger.info('Handling MCP Streamable HTTP request');

      // Send initial connection success message
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
      
      // Process the input if present
      if (req.body && req.body.jsonrpc === '2.0') {
        await this.handleJsonRpcRequest(req.body, res, 'streamable');
      }

      // Set up error handling for client disconnect
      req.on('close', () => {
        this.logger.info('Client disconnected from Streamable HTTP');
      });

    } catch (error) {
      this.logger.error('Error in Streamable HTTP handler:', error);
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
   * Handle JSON-RPC request
   */
  private async handleJsonRpcRequest(request: any, res: Response, transport: 'sse' | 'streamable'): Promise<void> {
    const { method, params, id } = request;
    
    this.logger.info(`Handling JSON-RPC method: ${method} via ${transport}`);
    
    switch (method) {
      case 'mcp.capabilities':
        this.handleCapabilitiesRequest(res, id, transport);
        break;
        
      case 'mcp.tool.use':
        await this.handleToolUseRequest(params, res, id, transport);
        break;
        
      case 'mcp.resource.list':
        await this.handleResourceListRequest(params, res, id, transport);
        break;
        
      case 'mcp.resource.get':
        await this.handleResourceGetRequest(params, res, id, transport);
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
  }

  /**
   * Handle capabilities request
   */
  private handleCapabilitiesRequest(res: Response, id: string | number, transport: 'sse' | 'streamable'): void {
    const tools = this.tools.map(t => ({
      name: t.name,
      description: t.description,
      parameterDescription: t.parameterDescription,
      returnDescription: t.returnDescription
    }));
    const resources = this.resources.map(r => ({ name: r.name, uri: r.uri }));
    
    this.sendMessage(res, {
      jsonrpc: '2.0',
      result: { tools, resources },
      id
    }, transport);
  }

  /**
   * Handle tool use request
   */
  private async handleToolUseRequest(params: any, res: Response, id: string | number, transport: 'sse' | 'streamable'): Promise<void> {
    const { name, parameters } = params;
    this.logger.info(`Tool use request for ${name}`, parameters);

    try {
      const tool = this.tools.find(t => t.name === name);
      if (!tool) throw new Error(`Tool not found: ${name}`);

      // Validate parameters using Joi
      const { error, value: validParams } = tool.parameters.validate(parameters);
      if (error) {
        throw new Error(`Invalid parameters for tool ${name}: ${error.details.map(d => d.message).join(', ')}`);
      }

      const result = await tool.execute(validParams);
      this.sendMessage(res, { jsonrpc: '2.0', result, id }, transport);
    } catch (error: any) {
      this.logger.error(`Error executing tool ${name}:`, error);
      this.sendMessage(res, {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: error.message || `Error executing tool ${name}`,
        },
        id
      }, transport);
    }
  }

  /**
   * Handle resource list request
   */
  private async handleResourceListRequest(params: any, res: Response, id: string | number, transport: 'sse' | 'streamable'): Promise<void> {
    const { name } = params;
    this.logger.info(`Resource list request for ${name}`);
    
    try {
      const resource = this.resources.find(r => r.name === name);
      if (!resource) throw new Error(`Resource not found: ${name}`);
      if (!resource.handlers.list) throw new Error(`List handler not defined for resource: ${name}`);
      const result = await resource.handlers.list();
      this.sendMessage(res, { jsonrpc: '2.0', result, id }, transport);
    } catch (error: any) {
      this.logger.error(`Error listing resource ${name}:`, error);
      this.sendMessage(res, {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: error.message || `Error listing resource ${name}`,
        },
        id
      }, transport);
    }
  }

  /**
   * Handle resource get request
   */
  private async handleResourceGetRequest(params: any, res: Response, id: string | number, transport: 'sse' | 'streamable'): Promise<void> {
    const { uri } = params;
    this.logger.info(`Resource get request for ${uri}`);
    
    try {
      const resource = this.resources.find(r => r.uri === uri);
      if (!resource) throw new Error(`Resource not found at URI: ${uri}`);
      if (!resource.handlers.get) throw new Error(`Get handler not defined for URI: ${uri}`);
      const result = await resource.handlers.get();
      this.sendMessage(res, { jsonrpc: '2.0', result, id }, transport);
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