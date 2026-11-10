import * as Cloudflare from "@alchemy.run/cloudflare";
import { RegistryStore } from "@tentacles/contracts/registry-store";
import { sqlRegistryStore } from "@tentacles/sql-registry/registry-store";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

/** The registry is one object; every caller reaches it by this name. */
const registryName = "registry";

/** The registry DO: RegistryStore on @tentacles/sql-registry over the object's SQLite. */
export class RegistryObject extends Cloudflare.DurableObject<
  RegistryObject,
  RegistryStore["Service"]
>()("RegistryObject") {}

// The instance Effect runs in the object's constructor inside blockConcurrencyWhile, so the
// migrations finish before any call reaches the store. Its SQLite is reachable only from inside
// the object, which is why they ship in the bundle.
export const RegistryObjectLive = RegistryObject.make(
  Effect.map(Effect.service(Cloudflare.DurableObjectState), (state) =>
    Effect.gen(function* () {
      const db = drizzle(state.raw.storage);

      // Imported here, not at the top: the deploy loads this module in Node, which cannot import
      // the migrations' .sql files; the Worker bundle carries them as text.
      const { default: migrations } = yield* Effect.promise(
        () => import("@tentacles/sql-registry/migrations"),
      );

      yield* Effect.promise(() => migrate(db, migrations));

      return yield* Effect.service(RegistryStore).pipe(Effect.provide(sqlRegistryStore(db)));
    }),
  ),
);

/** RegistryStore for code outside the registry object: each member is a call to it. */
export const registryStoreLayer = (registries: Cloudflare.DurableObject<RegistryObject>) => {
  const registry = () => registries.getByName(registryName);

  return Layer.succeed(
    RegistryStore,
    RegistryStore.of({
      add: (sessionId, name, parent) => registry().add(sessionId, name, parent),
      setStatus: (sessionId, status) => registry().setStatus(sessionId, status),
      list: (parent) => registry().list(parent),
      remove: (sessionId) => registry().remove(sessionId),
      openPreview: (sessionId, port) => registry().openPreview(sessionId, port),
      resolvePreview: (token) => registry().resolvePreview(token),
      closePreview: (sessionId) => registry().closePreview(sessionId),
      stoppedBefore: (before) => registry().stoppedBefore(before),
    }),
  );
};
