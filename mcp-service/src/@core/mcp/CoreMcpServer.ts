import { Request, Response } from 'express';
import Joi from 'joi';
import configManager from '../config/configManager.js';
import { createLogger } from '../utils/logger.js';
import { ToolService } from '../services/ToolService.js';
import { ToolSchema } from '../config/toolConfig.js';

/**
 * Interface for resource handlers
 */
interface ResourceHandlers {
  list?: () => Promise<any>;
  get?: () => Promise<any>;
}

/**
 * Interface for resource configuration
 */
interface ResourceConfig {
  name: string;
  uri: string;
  handlers: ResourceHandlers;
}

/**
 * Enhanced implementation of Model Context Protocol (MCP) server
 * that supports dynamic registration of tools and resources through configuration
 */
export class CoreMcpServer {
  private tools: Map<string, {
    config: ToolSchema;
    service: ToolService;
  }> = new Map();
  private resources: ResourceConfig[] = [];
  private services: Map<string, ToolService> = new Map();
  private logger = createLogger('CoreMcpServer');

  constructor() {
    this.logger.info('CoreMcpServer initialized');
  }
  
  /**
   * Register a service for tool execution
   * @param name The name of the service
   * @param service The service implementation
   */
  public registerService(name: string, service: ToolService): void {
    this.services.set(name, service);
    this.logger.info(`Registered service: ${name}`);
  }
  
  /**
   * Register a tool with the server
   * @param config Tool configuration
   */
  public registerTool(config: ToolSchema): void {
    // Check if the tool is enabled in environment configuration
    const envEnabled = configManager.get(`tools.${config.name.toLowerCase()}.enabled`);
    const isEnabled = envEnabled !== undefined ? envEnabled : config.enabled;
    
    if (!isEnabled) {
      this.logger.info(`Tool ${config.name} is disabled, skipping registration`);
      return;
    }
    
    // Make sure the service exists
    const service = this.services.get(config.serviceName);
    if (!service) {
      this.logger.warn(`Cannot register tool ${config.name}: service ${config.serviceName} not found`);
      return;
    }
    
    // Store the tool configuration and service reference
    this.tools.set(config.name, { config, service });
    this.logger.info(`Registered tool: ${config.name} (${config.description})`);
  }
  
  /**
   * Register multiple tools from a configuration object
   * @param toolsConfig Object containing tool configurations
   */
  public registerToolsFromConfig(toolsConfig: Record<string, any>): void {
    // Convert JSON Schema format to Joi schema for each tool
    for (const [key, config] of Object.entries(toolsConfig)) {
      // Skip if the tool name doesn't match the key (for safety)
      if (config.name !== key) {
        this.logger.warn(`Tool name mismatch: ${config.name} vs ${key}, skipping`);
        continue;
      }
      
      // Convert parameters and returns from JSON Schema to Joi schema
      try {
        const paramSchema = this.convertJsonSchemaToJoi(config.parameters);
        const returnSchema = this.convertJsonSchemaToJoi(config.returns);
        
        // Create a proper tool configuration
        const toolConfig: ToolSchema = {
          name: config.name,
          description: config.description,
          serviceName: config.serviceName,
          methodName: config.methodName,
          parameterDescription: config.parameterDescription,
          returnDescription: config.returnDescription,
          parameters: paramSchema,
          returns: returnSchema,
          enabled: config.enabled !== false // Default to true if not specified
        };
        
        // Register the tool
        this.registerTool(toolConfig);
      } catch (error) {
        this.logger.error(`Error registering tool ${key} from config:`, error);
      }
    }
  }
  
  /**
   * Register a resource with the server
   * @param resourceConfig Resource configuration
   */
  public resource(resourceConfig: ResourceConfig): void {
    this.resources.push(resourceConfig);
    this.logger.info(`Registered resource: ${resourceConfig.name} (${resourceConfig.uri})`);
  }

  /**
   * Handle HTTP request for the MCP SSE connection
   * @param req Express request
   * @param res Express response
   */
  public async handleHttpRequest(req: Request, res: Response): Promise<void> {
    try {
      this.logger.info('Handling MCP SSE request');

      // Send initial connection success message
      this.sendSseMessage(res, {
        jsonrpc: '2.0',
        result: {
          mcp: {
            name: configManager.get('mcpName'),
            version: configManager.get('mcpVersion'),
            description: configManager.get('mcpDescription')
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
   * Handle HTTP request for the MCP Streamable HTTP endpoint
   * @param req Express request
   * @param res Express response
   */
  public async handleStreamableHttpRequest(req: Request, res: Response): Promise<void> {
    try {
      this.logger.info('Handling MCP Streamable HTTP request');

      // Send initial connection success message
      this.sendStreamableHttpMessage(res, {
        jsonrpc: '2.0',
        result: {
          mcp: {
            name: configManager.get('mcpName'),
            version: configManager.get('mcpVersion'),
            description: configManager.get('mcpDescription')
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
   * @param request JSON-RPC request object
   * @param res Express response
   * @param transport Transport type ('sse' or 'streamable')
   */
  private async handleJsonRpcRequest(
    request: any,
    res: Response,
    transport: 'sse' | 'streamable'
  ): Promise<void> {
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
   * @param res Express response
   * @param id JSON-RPC request ID
   * @param transport Transport type
   */
  private handleCapabilitiesRequest(
    res: Response, 
    id: string | number, 
    transport: 'sse' | 'streamable'
  ): void {
    const tools = Array.from(this.tools.values()).map(({ config }) => ({
      name: config.name,
      description: config.description,
      parameterDescription: config.parameterDescription,
      returnDescription: config.returnDescription
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
   * @param params Request parameters
   * @param res Express response
   * @param id JSON-RPC request ID
   * @param transport Transport type
   */
  private async handleToolUseRequest(
    params: any,
    res: Response,
    id: string | number,
    transport: 'sse' | 'streamable'
  ): Promise<void> {
    const { name, parameters } = params;
    this.logger.info(`Tool use request for ${name}`, parameters);

    try {
      const tool = this.tools.get(name);
      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }

      // Validate parameters using Joi
      const { error, value: validParams } = tool.config.parameters.validate(parameters);
      if (error) {
        throw new Error(`Invalid parameters for tool ${name}: ${error.details.map(d => d.message).join(', ')}`);
      }

      // Get the service and method to execute
      const service = tool.service;
      const method = tool.config.methodName;
      
      if (!service || typeof (service as any)[method] !== 'function') {
        throw new Error(`Method ${method} not found on service for tool ${name}`);
      }
      
      // Execute the tool method
      const result = await (service as any)[method](validParams);
      
      // Validate the result using the return schema
      const { error: returnError } = tool.config.returns.validate(result);
      if (returnError) {
        this.logger.warn(`Tool ${name} returned invalid result:`, returnError);
      }
      
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
   * @param params Request parameters
   * @param res Express response
   * @param id JSON-RPC request ID
   * @param transport Transport type
   */
  private async handleResourceListRequest(
    params: any,
    res: Response,
    id: string | number,
    transport: 'sse' | 'streamable'
  ): Promise<void> {
    const { name } = params;
    this.logger.info(`Resource list request for ${name}`);
    
    try {
      const resource = this.resources.find(r => r.name === name);
      if (!resource) {
        throw new Error(`Resource not found: ${name}`);
      }
      
      if (!resource.handlers.list) {
        throw new Error(`List handler not defined for resource: ${name}`);
      }
      
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
   * @param params Request parameters
   * @param res Express response
   * @param id JSON-RPC request ID
   * @param transport Transport type
   */
  private async handleResourceGetRequest(
    params: any,
    res: Response,
    id: string | number,
    transport: 'sse' | 'streamable'
  ): Promise<void> {
    const { uri } = params;
    this.logger.info(`Resource get request for ${uri}`);
    
    try {
      const resource = this.resources.find(r => r.uri === uri);
      if (!resource) {
        throw new Error(`Resource not found at URI: ${uri}`);
      }
      
      if (!resource.handlers.get) {
        throw new Error(`Get handler not defined for URI: ${uri}`);
      }
      
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
   * @param res Express response
   * @param message Message to send
   * @param transport Transport type
   */
  private sendMessage(
    res: Response,
    message: any,
    transport: 'sse' | 'streamable'
  ): void {
    if (transport === 'sse') {
      this.sendSseMessage(res, message);
    } else {
      this.sendStreamableHttpMessage(res, message);
    }
  }

  /**
   * Send SSE message to the client (legacy transport)
   * @param res Express response
   * @param message Message to send
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
   * @param res Express response
   * @param message Message to send
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

  /**
   * Convert JSON Schema format to Joi schema
   * This is a simplified conversion for common types
   * @param jsonSchema JSON Schema object
   * @returns Joi schema
   */
  private convertJsonSchemaToJoi(jsonSchema: any): Joi.Schema {
    if (!jsonSchema || typeof jsonSchema !== 'object') {
      return Joi.any();
    }

    // Handle primitive types
    if (jsonSchema.type === 'string') {
      let schema = Joi.string();
      if (jsonSchema.format === 'uri') schema = schema.uri();
      if (jsonSchema.enum) schema = schema.valid(...jsonSchema.enum);
      return schema;
    } else if (jsonSchema.type === 'number') {
      let schema = Joi.number();
      if (jsonSchema.minimum !== undefined) schema = schema.min(jsonSchema.minimum);
      if (jsonSchema.maximum !== undefined) schema = schema.max(jsonSchema.maximum);
      return schema;
    } else if (jsonSchema.type === 'integer') {
      let schema = Joi.number().integer();
      if (jsonSchema.minimum !== undefined) schema = schema.min(jsonSchema.minimum);
      if (jsonSchema.maximum !== undefined) schema = schema.max(jsonSchema.maximum);
      return schema;
    } else if (jsonSchema.type === 'boolean') {
      return Joi.boolean();
    } else if (jsonSchema.type === 'array') {
      let schema = Joi.array();
      if (jsonSchema.items) {
        schema = schema.items(this.convertJsonSchemaToJoi(jsonSchema.items));
      }
      return schema;
    } else if (jsonSchema.type === 'object') {
      let schema: Joi.ObjectSchema = Joi.object();
      
      // Process properties
      if (jsonSchema.properties) {
        const schemaMap: Record<string, Joi.Schema> = {};
        
        for (const [key, propSchema] of Object.entries(jsonSchema.properties)) {
          schemaMap[key] = this.convertJsonSchemaToJoi(propSchema);
        }
        
        schema = schema.keys(schemaMap);
      }
      
      // Process required fields
      if (Array.isArray(jsonSchema.required)) {
        for (const field of jsonSchema.required) {
          if (schema.extract(field)) {
            schema = schema.concat(Joi.object({
              [field]: (schema as any).extract(field).required()
            }));
          }
        }
      }
      
      return schema;
    }
    
    // Default case
    return Joi.any();
  }
}