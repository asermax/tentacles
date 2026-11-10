---
title: "Technical design"
summary: "Index of the notes about the shape of the system and how each part works"
---

# Technical design

This folder holds the shape of the system and how each part works. Each note explains one part of it; the reasoning behind a choice sits in a callout next to the mechanism it justifies. See [the docs charter](../README.md) for how a note is written.

## What notes exist

One row per note, kept by hand: adding a note here is part of writing it.

| Note | Explains |
|---|---|
| [Runtime components](runtime-components.md) | The parts tentacles runs on Cloudflare, the calls and data passed between them, and the provider-neutral contracts each part fills |
| [Sessions](sessions.md) | The session record and registry entry tentacles stores, its lifecycle, and the daily job that deletes old sessions |
| [Worker API](worker-api.md) | The calls and the per-session socket the plugin uses, and the session state they return |
| [Question round trip](question-round-trip.md) | How a remote agent's question reaches the parent and how the answer resumes the run |
| [Workspace](workspace.md) | The per-session container: start, lifetime, pending work, the agent's tools, and the preview with a Browser Run browser |
| [Plugin](plugin.md) | The pi and Claude Code plugin: its parts, tools, wake messages, how the parent's local list stays in sync, and how it is published and installed |
