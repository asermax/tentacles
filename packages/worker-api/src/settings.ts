import * as Schema from "effect/Schema";

export const Repository = Schema.Struct({
  url: Schema.String,
  shallow: Schema.Boolean,
});

export type Repository = typeof Repository.Type;

// A null repository leaves the clone to what the prompt names, and the commit
// checks do not run.
export const Settings = Schema.Struct({
  provider: Schema.String,
  model: Schema.String,
  effort: Schema.String,
  image: Schema.String,
  size: Schema.String,
  lifetime: Schema.Int,
  repository: Schema.NullOr(Repository),
});

export type Settings = typeof Settings.Type;
