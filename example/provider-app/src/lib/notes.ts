import { database, ensureDatabase } from "./database";
import { welcomeNoteInsert } from "./demo-note-seed";

export type DemoNote = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  createdByAgentName: string | null;
};

async function nextNoteId() {
  const latest = await database
    .prepare(
      "SELECT id FROM demoNote WHERE id LIKE 'note_%' ORDER BY CAST(SUBSTR(id, 6) AS INTEGER) DESC LIMIT 1",
    )
    .first<{ id: string }>();

  const nextNumber = Number(latest?.id.match(/^note_(\d+)$/)?.[1] ?? "0") + 1;
  return `note_${nextNumber}`;
}

export async function listNotes() {
  await ensureDatabase();
  const result = await database
    .prepare(
      "SELECT id, title, body, createdAt, createdByAgentName FROM demoNote ORDER BY createdAt ASC",
    )
    .all<DemoNote>();
  return result.results;
}

export async function createNote(input: {
  title: string;
  body?: string;
  createdByAgentName?: string;
}) {
  await ensureDatabase();
  const note: DemoNote = {
    id: await nextNoteId(),
    title: input.title,
    body: input.body ?? "",
    createdAt: new Date().toISOString(),
    createdByAgentName: input.createdByAgentName ?? null,
  };
  await database
    .prepare(
      `INSERT INTO demoNote
        (id, title, body, createdAt, createdByAgentName)
        VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(note.id, note.title, note.body, note.createdAt, note.createdByAgentName)
    .run();
  return note;
}

export async function resetDemoData() {
  await ensureDatabase();
  await database.batch([
    database.prepare("DELETE FROM approvalRequest"),
    database.prepare("DELETE FROM agentCapabilityGrant"),
    database.prepare("DELETE FROM agent"),
    database.prepare("DELETE FROM agentHost"),
    database.prepare("DELETE FROM demoNote"),
  ]);
  await welcomeNoteInsert(database).run();
}
