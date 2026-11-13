import * as Schema from "effect/Schema";

// Git reaches GitHub over HTTPS with the credentials added at egress, so any
// other form (a bare host, git@host:path) fails at the first clone instead.
export const Repository = Schema.Struct({
  url: Schema.String.check(
    Schema.isPattern(/^https?:\/\/[^/\s]+/, {
      message: "repository URL must start with https:// (or http://) and name a host",
    }),
  ),
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
