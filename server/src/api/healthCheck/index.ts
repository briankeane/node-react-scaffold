import express from 'express';
import controller from './healthCheck.api';

const router = express.Router();

router.get('/', controller.healthCheckEndpoint);
