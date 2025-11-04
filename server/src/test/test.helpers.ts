export async function clearDatabase(db: any): Promise<void> {
  if (!db || !db.sequelize || !db.models) {
    return;
  }

  await db.sequelize.query("SET session_replication_role = replica;");

  const modelEntries = Object.values(db.models) as Array<{
    destroy: (options: Record<string, unknown>) => Promise<unknown>;
  }>;

  for (const model of modelEntries) {
    await model.destroy({ where: {}, cascade: true, force: true });
  }

  await db.sequelize.query("SET session_replication_role = DEFAULT;");
}

export function parseJwt(token: string): unknown {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const buff = Buffer.from(base64, "base64");
  const payload = buff.toString("utf8");
  return JSON.parse(payload);
}

export default { clearDatabase, parseJwt };

if (typeof module !== "undefined") {
  module.exports = { clearDatabase, parseJwt };
}
