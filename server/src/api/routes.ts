import { Application } from 'express';

function addRoutes(app: Application) {
  app.use('/v1/healthCheck', require('./healthCheck'));
}

export default addRoutes;
