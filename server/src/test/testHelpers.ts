import nock from 'nock';
import { Model, ModelStatic } from 'sequelize';
import db from '../db';

export async function clearDatabase() {
  if (process.env.NODE_ENV !== 'test') return;

  await db.sequelize.query('SET session_replication_role = replica;');

  for (const modelName of Object.keys(db.models)) {
    await (
      db.models as Record<string, ModelStatic<Model>>
    )[modelName].destroy({
      where: {},
      cascade: true,
      force: true,
    });
  }

  await db.sequelize.query('SET session_replication_role = DEFAULT;');
}

export function checkAndClearNocks() {
  if (!nock.isDone()) {
    const pending = nock.pendingMocks();
    nock.cleanAll();
    throw new Error(`Pending nock mocks: ${pending.join(', ')}`);
  }
  nock.cleanAll();
}
