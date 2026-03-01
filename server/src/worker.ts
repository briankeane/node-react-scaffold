import logger from './logger';

const port = process.env.PORT || 10030;

logger.log(`Worker starting on port ${port}...`);

// Add cron jobs here. Example:
// import cron from 'node-cron';
// cron.schedule('*/15 * * * *', async () => {
//   logger.log('Running scheduled task...');
// });

// Add queue workers here. Example:
// import { createWorker } from './queue';
// createWorker('emailQueue', async (job) => {
//   logger.log(`Processing job ${job.id}`);
// });

logger.log('Worker ready.');
