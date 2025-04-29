import { RequestHandler } from 'express';

const healthCheckEndpoint: RequestHandler = (_req, res) => {
  res.status(200).json({ healthy: true });
};

export default {
  healthCheckEndpoint,
};
