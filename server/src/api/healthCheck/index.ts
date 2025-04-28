import express from 'express';
import controller from './healthCheck.api';

console.log('hi;0');
const router = express.Router();

router.get('/', controller.healthCheckEndpoint);
