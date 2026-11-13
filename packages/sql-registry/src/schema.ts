import type { SessionDetails } from "@tentacles/worker-api/session-state";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// One entry per session. `status` is empty until the session reports its first
// one; `lastStopped` (epoch milliseconds) is empty while a run goes on; the
// preview columns are set together, while a preview is open. `settings`,
// `skillNames` and `agentNames` are a copy of the session's details, written
// once at creation. Their defaults exist only so the migration can add the
// columns to a table that already has rows.
export const registry = sqliteTable(
  "registry",
  {
    sessionId: text("session_id").primaryKey().notNull(),
    name: text("name").notNull(),
    parentHarness: text("parent_harness").notNull(),
    parentSessionId: text("parent_session_id").notNull(),
    settings: text("settings", { mode: "json" })
      .$type<SessionDetails["settings"]>()
      .notNull()
      .default(sql`'{}'`),
    skillNames: text("skill_names", { mode: "json" })
      .$type<SessionDetails["skills"]>()
      .notNull()
      .default([]),
    agentNames: text("agent_names", { mode: "json" })
      .$type<SessionDetails["agents"]>()
      .notNull()
      .default([]),
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
