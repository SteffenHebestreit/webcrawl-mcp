import { createLogger, Logger } from '../../utils/logger';

/**
 * Base class for all MCP tool implementations
 * Provides common functionality and structure for tools
 */
export abstract class BaseTool<TParams, TResponse> {
  protected logger: Logger;
  
  constructor(toolName: string) {
    this.logger = createLogger(toolName);
  }
  
  /**
   * Execute the tool with the provided parameters
   * @param params The parameters for the tool execution
   * @returns A promise that resolves to the tool's response
   */
  public abstract execute(params: TParams): Promise<TResponse>;
}
