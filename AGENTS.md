# tentacles

tentacles runs coding-agent sessions remotely, on pi-durable, over infrastructure behind provider-neutral contracts, with Cloudflare as the first setup. A plugin for pi and Claude Code lets a local agent spawn, steer, question and collect those remote sessions the way it does local subagents.

## Docs

- **Docs**: `docs/`. Read its `README.md` before adding, editing, renaming or moving anything under it.
- **Folders**: `technical-design/`, the shape of the system and how each part works; `product-design/`, what tentacles is and what it is like to use.
- **Checks**: `pnpm check` · `pnpm test`

### When adding something

- A change to how a part of the system works → a note in `docs/technical-design/`
- A change to what the parent agent or the person using tentacles sees or does → a note in `docs/product-design/`
- A rule every change has to respect → a line in `docs/invariants.md`
