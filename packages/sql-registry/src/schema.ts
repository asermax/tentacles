import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// One entry per session. `status` is empty until the session reports its first
// one; `lastStopped` (epoch milliseconds) is empty while a run goes on; the
// preview columns are set together, while a preview is open.
export const registry = sqliteTable(
  "registry",
  {
    sessionId: text("session_id").primaryKey().notNull(),
    name: text("name").notNull(),
    parentHarness: text("parent_harness").notNull(),
    parentSessionId: text("parent_session_id").notNull(),
    status: text("status"),
    lastStopped: integer("last_stopped"),
    previewPort: integer("preview_port"),
    previewToken: text("preview_token").unique(),
  },
  (table) => [
    index("registry_parent_index").on(table.parentHarness, table.parentSessionId),
    index("registry_last_stopped_index").on(table.lastStopped),
  ],
);
