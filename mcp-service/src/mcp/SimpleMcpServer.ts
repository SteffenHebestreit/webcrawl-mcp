import { Request, Response } from 'express';
import { ConfigService } from '../services/configService';
import { ToolConfig, ResourceConfig } from '../types/mcp';

/**
 * A simple implementation of Model Context Protocol (MCP) server
 * that supports dynamic registration of tools and resources
 */
export class SimpleMcpServer {
  private config: ConfigService;
  private tools: ToolConfig<any, any>[] = [];
  private resources: ResourceConfig[] = [];

  constructor(config: ConfigService) {
    this.config = config;
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
   * Handle HTTP request for the MCP SSE connection
   */
  async handleHttpRequest(req: Request, res: Response): Promise<void> {
    try {
      console.log('Handling MCP SSE request');

      // Send initial connection success message
      this.sendMessage(res, {
        jsonrpc: '2.0',
        result: {
          mcp: {
            name: this.config.get('mcpName'),
            version: this.config.get('mcpVersion'),
            description: this.config.get('mcpDescription')
          }
        },
        id: null
      });
      
      // Process the input if present
      if (req.body && req.body.jsonrpc === '2.0') {
        await this.handleJsonRpcRequest(req.body, res);
      }

      // Set up error handling for client disconnect
      req.on('close', () => {
        console.log('Client disconnected from SSE');
      });

    } catch (error) {
      console.error('Error in SSE handler:', error);
      this.sendMessage(res, {
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
  private async handleJsonRpcRequest(request: any, res: Response): Promise<void> {
    const { method, params, id } = request;
    
    console.log(`Handling JSON-RPC method: ${method}`);
    
    switch (method) {
      case 'mcp.capabilities':
        this.handleCapabilitiesRequest(res, id);
        break;
        
      case 'mcp.tool.use':
        await this.handleToolUseRequest(params, res, id);
        break;
        
      case 'mcp.resource.list':
        await this.handleResourceListRequest(params, res, id);
        break;
        
      case 'mcp.resource.get':
        await this.handleResourceGetRequest(params, res, id);
        break;
        
      default:
        this.sendMessage(res, {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
          id
        });
    }
  }

  /**
   * Handle capabilities request
   */
  private handleCapabilitiesRequest(res: Response, id: string | number): void {
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
    });
  }

  /**
   * Handle tool use request
   */
  private async handleToolUseRequest(params: any, res: Response, id: string | number): Promise<void> {
    const { name, parameters } = params;
    console.log(`Tool use request for ${name} with params:`, parameters);
    
    try {
      const tool = this.tools.find(t => t.name === name);
      if (!tool) throw new Error(`Tool not found: ${name}`);
      const validParams = tool.parameters.parse(parameters);
      const result = await tool.execute(validParams);
      this.sendMessage(res, { jsonrpc: '2.0', result, id });
    } catch (error: any) {
      console.error(`Error executing tool ${name}:`, error);
      this.sendMessage(res, {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: error.message || `Error executing tool ${name}`,
        },
        id
      });
    }
  }

  /**
   * Handle resource list request
   */
  private async handleResourceListRequest(params: any, res: Response, id: string | number): Promise<void> {
    const { name } = params;
    console.log(`Resource list request for ${name}`);
    
    try {
      const resource = this.resources.find(r => r.name === name);
      if (!resource) throw new Error(`Resource not found: ${name}`);
      if (!resource.handlers.list) throw new Error(`List handler not defined for resource: ${name}`);
      const result = await resource.handlers.list();
      this.sendMessage(res, { jsonrpc: '2.0', result, id });
    } catch (error: any) {
      console.error(`Error listing resource ${name}:`, error);
      this.sendMessage(res, {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: error.message || `Error listing resource ${name}`,
        },
        id
      });
    }
  }

  /**
   * Handle resource get request
   */
  private async handleResourceGetRequest(params: any, res: Response, id: string | number): Promise<void> {
    const { uri } = params;
    console.log(`Resource get request for ${uri}`);
    
    try {
      const resource = this.resources.find(r => r.uri === uri);
      if (!resource) throw new Error(`Resource not found at URI: ${uri}`);
      if (!resource.handlers.get) throw new Error(`Get handler not defined for URI: ${uri}`);
      const result = await resource.handlers.get();
      this.sendMessage(res, { jsonrpc: '2.0', result, id });
    } catch (error: any) {
      console.error(`Error getting resource at ${uri}:`, error);
      this.sendMessage(res, {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: error.message || `Error getting resource at ${uri}`,
        },
        id
      });
    }
  }

  /**
   * Send SSE message to the client
   */
  private sendMessage(res: Response, message: any): void {
    try {
      res.write(`data: ${JSON.stringify(message)}\n\n`);
      res.flushHeaders();
    } catch (error) {
      console.error('Error sending SSE message:', error);
    }
  }
}