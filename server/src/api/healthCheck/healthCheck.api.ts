import { RequestHandler } from 'express';

const healthCheckEndpoint: RequestHandler = (_req, res, _next) => {
  res.status(200).json({ healthy: true });
};

export default {
  healthCheckEndpoint,
};
