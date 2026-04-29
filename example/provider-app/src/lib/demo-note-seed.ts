export type DemoNoteSeed = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  createdByAgentName: string;
};

export const welcomeNote: DemoNoteSeed = {
  id: "note_1",
  title: "Welcome",
  body: "This note came from the dummy provider app.",
  createdAt: new Date(0).toISOString(),
  createdByAgentName: "Demo Welcome Wagon",
};

export function welcomeNoteInsert(database: D1Database) {
  return database
    .prepare(
      `INSERT OR IGNORE INTO demoNote
        (id, title, body, createdAt, createdByAgentName)
        VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      welcomeNote.id,
      welcomeNote.title,
      welcomeNote.body,
      welcomeNote.createdAt,
      welcomeNote.createdByAgentName,
    );
}
