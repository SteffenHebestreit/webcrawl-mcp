import { Router, Request, Response } from 'express';
import config from '../config';
import { ToolController } from '../controllers/toolController';
import { createLogger } from '../utils/logger';

export function setupApiRoutes(): Router {
  const router = Router();
  const logger = createLogger('API-Routes');
  
  // Initialize tool controller for direct API access
  const toolController = new ToolController(config);

  // Add a basic health check endpoint
  router.get('/health', (req: Request, res: Response) => {
    res.status(200).send('OK');
  });

  // Add version info endpoint
  router.get('/version', (req: Request, res: Response) => {
    res.status(200).json({
      name: config.get('mcpName'),
      version: config.get('mcpVersion'),
      description: config.get('mcpDescription')
    });
  });

  // Add tools listing endpoint
  router.get('/tools', (req: Request, res: Response) => {
    try {
      const crawlTool = toolController.getCrawlToolConfig();
      const markdownTool = toolController.getMarkdownCrawlToolConfig();
      
      res.status(200).json({
        success: true,
        tools: [
          {
            name: crawlTool.name,
            description: crawlTool.description,
            parameterDescription: crawlTool.parameterDescription,
            returnDescription: crawlTool.returnDescription,
            endpoint: `/api/tools/${crawlTool.name}`
          },
          {
            name: markdownTool.name,
            description: markdownTool.description,
            parameterDescription: markdownTool.parameterDescription,
            returnDescription: markdownTool.returnDescription,
            endpoint: `/api/tools/${markdownTool.name}`
          }
        ]
      });
    } catch (error: any) {
      logger.error('Error listing tools:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list available tools',
        message: error.message
      });
    }
  });

  // Add direct crawl tool endpoint
  router.post('/tools/crawl', async (req: Request, res: Response) => {
    try {
      logger.info('Direct crawl tool invocation:', req.body);
      
      const toolConfig = toolController.getCrawlToolConfig();
      
      // Validate parameters using Joi schema
      const { error, value } = toolConfig.parameters.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid parameters',
          details: error.details.map(d => d.message)
        });
      }
      
      // Execute the tool
      const result = await toolConfig.execute(value);
      res.status(200).json(result);
      
    } catch (error: any) {
      logger.error('Error executing crawl tool:', error);
      res.status(500).json({
        success: false,
        error: 'Tool execution failed',
        message: error.message
      });
    }
  });

  // Add direct crawlWithMarkdown tool endpoint  
  router.post('/tools/crawlWithMarkdown', async (req: Request, res: Response) => {
    try {
      logger.info('Direct crawlWithMarkdown tool invocation:', req.body);
      
      const toolConfig = toolController.getMarkdownCrawlToolConfig();
      
      // Validate parameters using Joi schema
      const { error, value } = toolConfig.parameters.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid parameters', 
          details: error.details.map(d => d.message)
        });
      }
      
      // Execute the tool
      const result = await toolConfig.execute(value);
      res.status(200).json(result);
      
    } catch (error: any) {
      logger.error('Error executing crawlWithMarkdown tool:', error);
      res.status(500).json({
        success: false,
        error: 'Tool execution failed',
        message: error.message
      });
    }
  });

  // Add tool abort endpoint
  router.post('/tools/abort/:toolId', async (req: Request, res: Response) => {
    try {
      const { toolId } = req.params;
      logger.info(`Received abort request for tool: ${toolId}`);

      if (!toolId) {
        return res.status(400).json({
          success: false,
          error: 'Missing tool ID',
          message: 'Tool ID is required to abort a tool execution'
        });
      }

      // Attempt to abort the tool execution
      const abortResult = toolController.abortToolExecution(toolId);
      
      if (abortResult) {
        logger.info(`Successfully aborted tool execution: ${toolId}`);
        return res.status(200).json({
          success: true,
          message: `Successfully aborted tool execution: ${toolId}`
        });
      } else {
        logger.warn(`Failed to abort tool execution: ${toolId}`);
        return res.status(404).json({
          success: false,
          error: 'Abort failed',
          message: `No active tool found with ID: ${toolId} or the tool could not be aborted`
        });
      }
    } catch (error: any) {
      logger.error(`Error aborting tool execution:`, error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  });

  return router;
}