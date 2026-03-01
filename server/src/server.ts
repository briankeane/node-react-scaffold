import bodyParser from 'body-parser';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import bearerToken from 'express-bearer-token';
import http from 'http';
import morgan from 'morgan';
import addRoutes from './api/routes';
import config from './config/config';
import addDocRoutes from './docs';
import logger from './logger';

export type AppWithIsReadyPromise = express.Application & {
  isReadyPromise: Promise<void>;
};

const port = config.PORT;
const app = express() as unknown as AppWithIsReadyPromise;

app.use(
  cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'PUT', 'POST', 'DELETE'],
    allowedHeaders: [
      'X-Requested-With',
      'X-HTTP-Method-Override',
      'Content-Type',
      'Accept',
      'Authorization',
    ],
  })
);

app.use(bearerToken());
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const setupPromises: Promise<unknown>[] = [];

if (config.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

const server = http.createServer(app);
addRoutes(app);
addDocRoutes(app);

// Error handler must be registered after all routes
import { errorHandler } from './api/errorHandler';
app.use(errorHandler);

if (require.main === module) {
  server.listen(port, () => {
    logger.log(`Server listening on port ${port}`);
  });
}

app.isReadyPromise = new Promise((resolve, reject) => {
  return Promise.all(setupPromises)
    .then(() => {
      return resolve();
    })
    .catch((err) => {
      logger.error(err);
      return reject(err);
    });
});

export default app;
