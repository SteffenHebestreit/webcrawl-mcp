import { createLogger, Logger } from '../../utils/logger';

/**
 * Base class for all MCP tool implementations
 * Provides common functionality and structure for tools
 */
export abstract class BaseTool<TParams, TResponse> {
  protected logger: Logger;
  protected abortController: AbortController | null = null;
  
  constructor(toolName: string) {
    this.logger = createLogger(toolName);
  }
  
  /**
   * Execute the tool with the provided parameters
   * @param params The parameters for the tool execution
   * @returns A promise that resolves to the tool's response
   */
  public abstract execute(params: TParams): Promise<TResponse>;

  /**
   * Abort the current tool execution
   * @returns A boolean indicating whether the abort was successful
   */
  public abort(): boolean {
    try {
      if (this.abortController) {
        this.logger.info('Aborting tool execution');
        this.abortController.abort();
        this.abortController = null;
        return true;
      }
      this.logger.warn('No active execution to abort');
      return false;
    } catch (error) {
      this.logger.error('Error aborting tool execution:', error);
      return false;
    }
  }
  
  /**
   * Create a new AbortController for a tool execution
   * @returns The AbortSignal from the AbortController
   */
  protected createAbortController(): AbortSignal {
    // Clean up any existing abort controller
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch (error) {
        this.logger.warn('Error cleaning up previous abort controller:', error);
      }
    }
    
    this.abortController = new AbortController();
    return this.abortController.signal;
  }
}
