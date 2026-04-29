import { env } from "cloudflare:workers";
import { bootstrapAgentAuthSchema } from "./bootstrap-agentauth-schema";
import { welcomeNoteInsert } from "./demo-note-seed";

export const database = env.DB;

let bootstrapPromise: Promise<void> | undefined;

export function ensureDatabase() {
  bootstrapPromise ??= bootstrapDatabase().catch((error) => {
    bootstrapPromise = undefined;
    throw error;
  });
  return bootstrapPromise;
}

async function bootstrapDatabase() {
  await bootstrapAgentAuthSchema(database);
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS demoNote (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      createdByAgentName TEXT
    )`,
    )
    .run();
  await database
    .prepare("CREATE INDEX IF NOT EXISTS idx_demoNote_createdAt ON demoNote(createdAt)")
    .run();

  await welcomeNoteInsert(database).run();
}
