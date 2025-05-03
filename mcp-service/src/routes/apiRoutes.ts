import { Router, Request, Response } from 'express';
import config from '../config';

export function setupApiRoutes(): Router {
  const router = Router();

  // Add a basic health check endpoint
  router.get('/health', (req: Request, res: Response) => {
    // TODO: Add more comprehensive health checks (e.g., Python availability)
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

  return router;
}