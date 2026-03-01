import logger from "./logger";

async function startWorker(): Promise<void> {
  logger.log("Worker started.");

  // --- Cron jobs ---
  // import cron from "node-cron";
  // cron.schedule("0 * * * *", () => {
  //   logger.log("Running hourly job...");
  // });

  // --- Queue workers ---
  // import { Worker } from "bullmq";
  // const worker = new Worker("myQueue", async (job) => {
  //   logger.log(`Processing job ${job.id}`, job.data);
  // });

  logger.log("Worker ready. Add cron jobs or queue workers above.");
}

startWorker().catch((err) => {
  logger.error(err);
  process.exit(1);
});
