---
title: "Cloudflare"
summary: "Index of the notes about how the Cloudflare provider fills tentacles' contracts"
---

# Cloudflare

See [the docs charter](../../../README.md) for how a note is written.

## What notes exist

One row per note, kept by hand: adding a note here is part of writing it.

| Note | Explains |
|---|---|
| [Cloudflare deploy](deploy.md) | The Worker and its routes, the session and registry Durable Objects, the Workspace Worker and its workspace Durable Objects, the Codemode Worker, the shared Claude container, the outbound handlers, the deploy stack, and which part fills each contract |
| [Cloudflare workspace](computer-workspace.md) | The Computer workspace: the isolate shell and container backends, `/workspace` in the session's workspace Durable Object, the git client and the egress gateway, the image, and the container's lifecycle |
| [Cloudflare preview](preview-and-browser.md) | How a preview request reaches the app in the container, and how agent-browser reaches its Browser Run browser through the egress gateway |
