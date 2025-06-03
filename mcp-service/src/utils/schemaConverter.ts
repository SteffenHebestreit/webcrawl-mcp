/**
 * Utility to convert Joi schemas to JSON Schema format for MCP compliance
 */
import Joi from 'joi';

/**
 * Convert a Joi schema to JSON Schema format
 */
export function joiToJsonSchema(joiSchema: Joi.Schema): any {
  try {
    // Use Joi's describe() method and convert it to JSON Schema
    const description = joiSchema.describe();
    return convertJoiDescriptionToJsonSchema(description);
  } catch (error) {
    console.warn('Failed to convert Joi schema to JSON Schema:', error);
    return {
      type: 'object',
      properties: {},
      additionalProperties: false
    };
  }
}

/**
 * Convert Joi description object to JSON Schema
 */
function convertJoiDescriptionToJsonSchema(desc: any): any {
  switch (desc.type) {
    case 'object':
      const properties: any = {};
      const required: string[] = [];
      
      if (desc.keys) {
        for (const [key, value] of Object.entries(desc.keys)) {
          properties[key] = convertJoiDescriptionToJsonSchema(value);
          
          // Check if field is required
          if ((value as any).flags?.presence === 'required') {
            required.push(key);
          }
        }
      }
      
      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
        additionalProperties: false
      };
    
    case 'string':
      const stringSchema: any = { type: 'string' };
      
      // Handle string validations
      if (desc.rules) {
        for (const rule of desc.rules) {
          switch (rule.name) {
            case 'uri':
              stringSchema.format = 'uri';
              break;
            case 'min':
              stringSchema.minLength = rule.args?.limit;
              break;
            case 'max':
              stringSchema.maxLength = rule.args?.limit;
              break;
          }
        }
      }
      
      // Handle allowed values (enum)
      if (desc.allow && Array.isArray(desc.allow)) {
        stringSchema.enum = desc.allow;
      }
      
      return stringSchema;
    
    case 'number':
      const numberSchema: any = { type: desc.flags?.unsafe ? 'number' : 'integer' };
      
      // Handle number validations
      if (desc.rules) {
        for (const rule of desc.rules) {
          switch (rule.name) {
            case 'min':
              numberSchema.minimum = rule.args?.limit;
              break;
            case 'max':
              numberSchema.maximum = rule.args?.limit;
              break;
            case 'integer':
              numberSchema.type = 'integer';
              break;
          }
        }
      }
      
      return numberSchema;
    
    case 'boolean':
      return { type: 'boolean' };
    
    case 'array':
      const arraySchema: any = { type: 'array' };
      
      if (desc.items && desc.items.length > 0) {
        // Handle single item type
        if (desc.items.length === 1) {
          arraySchema.items = convertJoiDescriptionToJsonSchema(desc.items[0]);
        } else {
          // Handle multiple item types (use anyOf)
          arraySchema.items = {
            anyOf: desc.items.map((item: any) => convertJoiDescriptionToJsonSchema(item))
          };
        }
      }
      
      return arraySchema;
    
    case 'any':
      return {}; // JSON Schema equivalent of "any"
    
    default:
      console.warn(`Unknown Joi type: ${desc.type}`);
      return { type: 'string' }; // Default fallback
  }
}

/**
 * Get JSON Schema for the crawl tool parameters
 */
export function getCrawlToolJsonSchema() {
  return {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        format: 'uri'
      },
      maxPages: {
        type: 'integer',
        minimum: 1
      },
      depth: {
        type: 'integer',
        minimum: 0
      },
      strategy: {
        type: 'string',
        enum: ['bfs', 'dfs', 'bestFirst']
      },
      captureNetworkTraffic: {
        type: 'boolean'
      },
      captureScreenshots: {
        type: 'boolean'
      },
      waitTime: {
        type: 'integer',
        minimum: 0
      }
    },
    required: ['url'],
    additionalProperties: false
  };
}

/**
 * Get JSON Schema for the crawlWithMarkdown tool parameters
 */
export function getCrawlWithMarkdownToolJsonSchema() {
  return {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        format: 'uri'
      },
      maxPages: {
        type: 'integer',
        minimum: 1
      },
      depth: {
        type: 'integer',
        minimum: 0
      },
      strategy: {
        type: 'string',
        enum: ['bfs', 'dfs', 'bestFirst']
      },
      query: {
        type: 'string'
      }
    },
    required: ['url'],
    additionalProperties: false
  };
}
