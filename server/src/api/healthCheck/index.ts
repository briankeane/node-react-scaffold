import express from 'express';
import controller from './healthCheck.api';

const router = express.Router();

router.get('/', controller.healthCheckEndpoint);

// Example with middleware:
// import { authenticateAccessToken } from '../middleware/security';
// import { checkBodyFor } from '../middleware/routeValidators';
// router.post('/', authenticateAccessToken, checkBodyFor(['name', 'email']), controller.createSomething);

export default router;
