import { fileURLToPath } from "node:url";

import { sqlRegistryStore } from "@tentacles/sql-registry/registry-store";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const migrationsFolder = fileURLToPath(
  new URL("migrations", import.meta.resolve("@tentacles/sql-registry/registry-store")),
);

/** sql-registry's RegistryStore over a new in-memory SQLite database. */
export const testRegistry = Layer.unwrap(
  Effect.sync(() => {
    const db = drizzle(new Database(":memory:"));

    migrate(db, { migrationsFolder });

    return sqlRegistryStore(db);
  }),
);
