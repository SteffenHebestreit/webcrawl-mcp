/**
 * Base interface for all tool services
 * Tool services provide the actual implementation of MCP tools
 */
export interface ToolService {
  /**
   * Get the name of this tool service
   */
  getName(): string;
  
  /**
   * Initialize the tool service with configuration
   * @param config The configuration object for this service
   */
  init(config: any): Promise<void>;

  /**
   * Shut down the tool service and clean up resources
   */
  shutdown(): Promise<void>;
}