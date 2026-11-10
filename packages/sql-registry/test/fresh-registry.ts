import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { sqlRegistryStore } from "../src/registry-store.ts";

const migrationsFolder = fileURLToPath(new URL("../src/migrations", import.meta.url));

/** The store over a new in-memory SQLite database, migrated with the package's migrations. */
export const freshRegistry = Layer.unwrap(
  Effect.sync(() => {
    const db = drizzle(new Database(":memory:"));

    migrate(db, { migrationsFolder });

    return sqlRegistryStore(db);
  }),
);
