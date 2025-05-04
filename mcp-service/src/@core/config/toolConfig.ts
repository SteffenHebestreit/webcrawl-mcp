import Joi from 'joi';

/**
 * Tool configuration schema that defines the structure for tool configurations
 */
export interface ToolSchema {
  name: string;
  description: string;
  serviceName: string;
  methodName: string;
  parameterDescription: string;
  returnDescription: string;
  parameters: Joi.Schema;
  returns: Joi.Schema;
  enabled: boolean;
}

/**
 * Configuration for all available tools in the MCP service
 */
export interface ToolsConfig {
  [key: string]: ToolSchema;
}