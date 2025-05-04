declare module '@modelcontextprotocol/sdk' {
  export class McpServer {
    constructor(options: { name: string; version: string; description: string });
    
    resource(config: {
      name: string;
      uri: string;
      handlers: {
        list?: () => Promise<{ uris: string[] }>;
        get?: () => Promise<{ contents: Array<{ uri: string; text: string }> }>;
      };
    }): void;
    
    tool(config: {
      name: string;
      parameters: any;
      returns: any;
      execute: (params: any) => Promise<any>;
      description: string;
      parameterDescription: string;
      returnDescription: string;
    }): void;
    
    handleHttpRequest(req: any, res: any): Promise<void>;
  }
}