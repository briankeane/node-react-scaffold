import logger from "../logger";
import { ensureRequiredEnvVars } from "./checkEnv";

export async function startWorker(): Promise<void> {
  ensureRequiredEnvVars();
  logger.log(
    "Worker setup complete. Implement job listeners in startWorker().",
  );
}

if (require.main === module) {
  startWorker().catch((err) => {
    logger.error(err);
    process.exit(1);
  });
}
