import * as Config from "effect/Config";

// The deploy fixes these two once the provider that serves glm-5.2 and the
// default workspace image have their ids; until then a session that keeps
// either default fails at create.
export const PlaceholderSessionProvider = "placeholder-session-provider";

export const PlaceholderWorkspaceImage = "placeholder-workspace-image";

/** Where the Worker is and the key it checks. */
export const ConnectionConfig = Config.all({
  url: Config.URL("TENTACLES_URL"),
  apiKey: Config.Redacted("TENTACLES_API_KEY"),
});

/** The settings a spawn leaves out. */
export const SettingsDefaults = Config.all({
  provider: Config.String("TENTACLES_SESSION_PROVIDER").pipe(
    Config.withDefault(PlaceholderSessionProvider),
  ),
  model: Config.String("TENTACLES_SESSION_MODEL").pipe(Config.withDefault("glm-5.2")),
  effort: Config.String("TENTACLES_SESSION_EFFORT").pipe(Config.withDefault("max")),
  image: Config.String("TENTACLES_WORKSPACE_IMAGE").pipe(
    Config.withDefault(PlaceholderWorkspaceImage),
  ),
  size: Config.String("TENTACLES_WORKSPACE_SIZE").pipe(Config.withDefault("basic")),
  lifetime: Config.Int("TENTACLES_WORKSPACE_LIFETIME").pipe(Config.withDefault(15)),
});

/** Read by the glues, not the helper: overrides the bundled helper's path. */
export const HelperPathVariable = "TENTACLES_HELPER";
