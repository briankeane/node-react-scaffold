import { Request, Response } from 'express';

function healthCheckEndpoint(_req: Request, res: Response) {
  return res.status(200).json({ healthy: true });
}

export default {
  healthCheckEndpoint,
} as { healthCheckEndpoint: (req: Request, res: Response) => void };
