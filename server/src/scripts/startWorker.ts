import { ensureRequiredEnvVars } from "./checkEnv";

export async function startWorker(): Promise<void> {
  ensureRequiredEnvVars();
  console.log(
    "Worker setup complete. Implement job listeners in startWorker().",
  );
}

if (require.main === module) {
  startWorker().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
