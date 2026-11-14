# tentacles plugin

One source builds a pi package (`build/out/pi`) and a Claude Code plugin (`build/out/claude`). Each gives the parent agent the tentacles tools, a status line of its open remote sessions, and a wake when a remote agent asks, finishes or fails. Every tool runs the bundled helper, the only client of the Worker API.

## Install

The plugin needs a deployed tentacles Worker: its URL and the API key it was deployed with go in `TENTACLES_URL` and `TENTACLES_API_KEY` (see Variables).

On pi, install the npm package:

```sh
pi install npm:@asermax/pi-tentacles
```

On Claude Code, add the marketplace and install the plugin:

```sh
claude plugin marketplace add asermax/tentacles@claude-marketplace
claude plugin install tentacles@tentacles
```

## Variables

The helper reads these where it runs, on your machine. On pi, set them in pi's settings env; on Claude Code, in the environment Claude Code starts with.

| Variable                       | What it sets                                | Default            |
| ------------------------------ | ------------------------------------------- | ------------------ |
| `TENTACLES_URL`                | the Worker's URL                            | required           |
| `TENTACLES_API_KEY`            | the API key                                 | required           |
| `TENTACLES_HELPER`             | the helper's path                           | the bundled helper |
| `TENTACLES_SESSION_PROVIDER`   | the model provider                          | `cloudflare`       |
| `TENTACLES_SESSION_MODEL`      | the model                                   | `glm-5.2`          |
| `TENTACLES_SESSION_EFFORT`     | the effort level                            | `max`              |
| `TENTACLES_WORKSPACE_IMAGE`    | the workspace image                         | `default`          |
| `TENTACLES_WORKSPACE_SIZE`     | the workspace container's instance type     | `basic`            |
| `TENTACLES_WORKSPACE_LIFETIME` | the workspace's inactivity time, in minutes | `15`               |

A setting the agent passes to `spawn` wins over its variable.

## Build

`pnpm build` bundles the helper, the pi extension and the Claude mod with vite, then `build/emit.ts` lays out both plugins with their manifests and the skill.

## Release

The version is the content of the `VERSION` file at the repository root; the build writes it into both manifests and the marketplace entry. Nobody edits it: on every push to `master`, CI runs semantic-release (config in `.releaserc.json`), which picks the next version from the conventional commits since the last `v*` tag (`fix` is a patch, `feat` a minor, a breaking change a major; other types release nothing), writes it to `VERSION`, rebuilds, and then:

- **pi package**: publishes `build/out/pi` to npm with provenance. npm authenticates with one of these, set up once:
  - **Trusted publisher**: on npmjs.com, open the package's Settings, then Trusted publishing. Add GitHub Actions with user `asermax`, repository `tentacles`, workflow filename `ci.yml` and no environment. Allow both `npm publish` and `npm stage publish`. npm offers trusted publishing only for a package that already exists.
  - **Token**: a granular npm access token with publish rights on the package, stored as the repository secret `NPM_TOKEN`. When both are set up, npm uses the trusted publisher.
- **Claude plugin**: runs `scripts/publish-marketplace.sh <version>`, which force-pushes `build/out/claude` as the root of the orphan `claude-marketplace` branch. `scripts/publish-marketplace.sh <version> /path/to/bare.git` pushes the same branch to a local bare repository instead of GitHub; run `pnpm build` first.
- **Repository**: commits `VERSION` and `CHANGELOG.md` to `master` with `[skip ci]`, creates the `v<version>` tag and the GitHub release.
