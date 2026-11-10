# tentacles plugin

One source builds a pi package (`build/out/pi`) and a Claude Code plugin (`build/out/claude`). Each gives the parent agent the tentacles tools, a status line of its open remote sessions, and a wake when a remote agent asks, finishes or fails. Every tool runs the bundled helper, the only client of the Worker API.

## Variables

The helper reads these where it runs, on your machine. On pi, set them in pi's settings env; on Claude Code, in the environment Claude Code starts with.

| Variable                       | What it sets                                | Default                        |
| ------------------------------ | ------------------------------------------- | ------------------------------ |
| `TENTACLES_URL`                | the Worker's URL                            | required                       |
| `TENTACLES_API_KEY`            | the API key                                 | required                       |
| `TENTACLES_HELPER`             | the helper's path                           | the bundled helper             |
| `TENTACLES_SESSION_PROVIDER`   | the model provider                          | a placeholder the deploy fixes |
| `TENTACLES_SESSION_MODEL`      | the model                                   | `glm-5.2`                      |
| `TENTACLES_SESSION_EFFORT`     | the effort level                            | `max`                          |
| `TENTACLES_WORKSPACE_IMAGE`    | the workspace image                         | a placeholder the deploy fixes |
| `TENTACLES_WORKSPACE_SIZE`     | the workspace container's instance type     | `basic`                        |
| `TENTACLES_WORKSPACE_LIFETIME` | the workspace's inactivity time, in minutes | `15`                           |

A setting the agent passes to `spawn` wins over its variable.

## Build

`pnpm build` bundles the helper, the pi extension and the Claude mod with vite, then `build/emit.ts` lays out both plugins with their manifests and the skill.
