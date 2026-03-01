import nock from "nock";
import { sequelize, models } from "../db";

export async function clearDatabase(): Promise<void> {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("clearDatabase can only be run in test environment");
  }

  await sequelize.query("SET session_replication_role = replica;");
  for (const model of Object.values(models)) {
    await model.destroy({ where: {}, force: true });
  }
  await sequelize.query("SET session_replication_role = DEFAULT;");
}

export function checkAndClearNocks(): void {
  if (!nock.isDone()) {
    const pending = nock.pendingMocks();
    nock.cleanAll();
    throw new Error(`Pending nock mocks: ${pending.join(", ")}`);
  }
  nock.cleanAll();
}
