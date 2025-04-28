import { Application } from 'express';
import healthCheckApi from './healthCheck';

function addRoutes(app: Application) {
  app.use('/v1/healthCheck', healthCheckApi);
}

export default addRoutes;
