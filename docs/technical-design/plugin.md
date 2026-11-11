---
title: "Plugin"
summary: "The tentacles plugin for pi and Claude Code: its parts on the developer's machine, the tools the parent agent sees, the wake messages, how the parent's local list of remote sessions stays in sync, and how the plugin is published and installed."
created: "2026-11-09"
---

# Plugin

## 🔭 Overview

The tentacles plugin gives a parent agent on pi or Claude Code one tool per action on its remote sessions: spawn, prompt, messages, wait (pi only), list, close and answer. It is built from one source into a pi package, published to npm, and a Claude plugin, published as a Claude Code marketplace. Each tool call runs a bundled helper CLI that calls the [Worker API](worker-api.md), and a long-running watch holds one socket per open session to update the status line and wake the parent when a session asks, finishes or fails. The plugin keeps a local list of the parent's remote sessions per harness session and syncs it with the Worker when the harness starts. It reaches tentacles only through the Worker API and the session sockets.

## 🏗️ Architecture

```mermaid
flowchart LR
    subgraph inputs["Inputs"]
        Env@{ shape: rect, label: "Environment<br/>Worker URL, API key,<br/>setting defaults" }
        Agent@{ shape: stadium, label: "Parent agent<br/>tool calls" }
    end
    subgraph plugin["tentacles plugin (pi package / Claude plugin, one source)"]
        direction LR
        Glue@{ shape: rect, label: "Harness glue<br/>pi extension / Claude mod" }
        Skill@{ shape: hex, label: "Skill<br/>protocol, remote children" }
        Helper@{ shape: rect, label: "Helper CLI<br/>one call per command,<br/>watch: one socket per open session" }
        Local@{ shape: cyl, label: "Local state<br/>pi session entry /<br/>CLAUDE_PLUGIN_DATA file" }
        Glue -->|"command and arguments"| Helper
        Helper -->|"result or error"| Glue
        Glue -->|"read at start, write on change"| Local
        Helper -->|"state events from watch"| Glue
    end
    Worker@{ shape: cloud, label: "Worker API<br/>and session sockets" }
    Status@{ shape: rect, label: "Status line<br/>name and status per session" }
    Wake@{ shape: rect, label: "Wake message<br/>question or last message" }
    Env --> Glue
    Agent -->|"one tool per action"| Glue
    Helper -->|"API key"| Worker
    Glue --> Status
    Glue --> Wake
    Skill -.->|"teaches the tools"| Agent

    classDef grey fill:#f3f4f6,stroke:#4b5563,color:#1f2937
    classDef blue fill:#dbeafe,stroke:#2563eb,color:#1f2937
    classDef green fill:#dcfce7,stroke:#16a34a,color:#1f2937
    classDef amber fill:#fef3c7,stroke:#d97706,color:#1f2937
    classDef orange fill:#ffedd5,stroke:#ea580c,color:#1f2937
    classDef violet fill:#ede9fe,stroke:#7c3aed,color:#1f2937
    class Agent grey
    class Env,Status,Wake blue
    class Glue,Helper green
    class Skill amber
    class Local orange
    class Worker violet
```

The **harness glue** is a pi extension on pi and a Claude mod on Claude Code. It registers the tools, turns each tool call into a helper command, keeps the parent's local state, updates the status line and delivers the wakes.

The **helper CLI** runs as one process per command, and as a long-running watch that holds one socket per open session in the local state and hands each state change back to the glue. It reads the Worker URL and the API key from environment variables, and the default session settings come from environment variables too (see Implementation details).

The **local state** is the parent's list of remote sessions, per harness session: a custom session entry on pi, a file under `CLAUDE_PLUGIN_DATA` on Claude Code. The glue reads it when the harness starts and writes it whenever the parent's sessions change.

The **skill** teaches the parent agent the tools with the same protocol it follows for local subagents, and adds that its children are remote: nothing of theirs runs locally, and their state and output are reachable only through the tools.

## ♠️ What it exposes

| Tool | On Claude Code (model sees) | On pi | Worker call |
|---|---|---|---|
| spawn | `mcp__tentacles__spawn` | `tentacles_spawn` | create |
| prompt | `mcp__tentacles__prompt` | `tentacles_prompt` | prompt |
| messages | `mcp__tentacles__messages` | `tentacles_messages` | messages |
| wait | none | `tentacles_wait` | waits on the session socket |
| list | `mcp__tentacles__list` | `tentacles_list` | list |
| close | `mcp__tentacles__close` | `tentacles_close` | close |
| answer | `mcp__tentacles__answer` | `tentacles_answer` | answer |

Each tool takes the arguments of its Worker API call and returns its result, except where the plugin fills in the parent itself. spawn takes the name, the first prompt and any settings the agent sets; the plugin fills every other setting from its defaults (see Implementation details). list takes no arguments. A Worker error, such as a deleted or unknown session or an answer to a question that is not waiting, reaches the agent as a tool failure carrying the Worker's message. When the plugin gets no usable answer from the Worker, the tool fails with an error naming the cause: the Worker did not answer at its URL, it answered with an unexpected status, or a required variable is unset. On Claude Code the plugin registers the tools by their bare names and the model sees them under the plugin's MCP prefix; on pi they carry the `tentacles_` prefix themselves.

> [!NOTE] Why Claude Code has no wait tool
> The Claude mod runs every helper process with `$.process.run`, which Claude Code caps at ten minutes, so a wait could not block until a remote agent stops. The mod has no need for one either: it wakes the parent itself by submitting the wake as a prompt, which starts a turn once the session is idle. herdr-subagents drops its wait on Claude Code for the same reason.

## ⏰ Wake messages

The watch wakes the parent with what it needs to act without another call:

| When | What the parent receives |
|---|---|
| a remote agent asks a question | the session, the question id and the question text |
| a run finishes | the session and its last message |
| a run fails | the session and its failure |

[question-round-trip](question-round-trip.md) follows a question to the parent and back.

On pi, a wake that arrives while the wait tool is waiting becomes the wait's result instead of a message. A wake that arrives while no wait is running goes out as a message, which pi holds until the parent's turn ends; the next wait returns that wake at once, unless the session has started running again since, and the wait after it waits for a new change.

> [!NOTE] Why the next wait returns a wake that already went out
> A wake can go out as a message while the parent's turn is still running, before the parent calls the wait. Returning it from the next wait keeps that wait from hanging on a change that already happened, as the wait of herdr-subagents does.

> [!WARNING] A headless parent gets no wake
> A parent running headless (`claude -p`) is never woken, the same as with local subagents. It learns of a question or a finished run only by calling the tools, and a question it never reads keeps its session waiting.

## 🔄 Parent state and sync

```mermaid
sequenceDiagram
    autonumber
    actor A as Parent agent
    participant G as Plugin glue
    participant L as Local list
    participant H as Helper watch
    participant W as Worker and registry
    participant St as Status line
    opt harness starts with a list that is not empty
        G->>W: list
        W-->>G: the parent's sessions, closed included
        G->>L: replace the list
    end
    A->>G: spawn, close, or a prompt that reopens
    G->>L: add, mark closed, or mark open
    H->>G: state event
    G->>L: update the status
    A->>G: a call on a session
    G->>W: the call
    W-->>G: the session does not exist
    G->>L: remove it
    L->>St: open sessions
```

The plugin keeps, per harness session, the parent's remote sessions with their name and status, closed ones included. The parent is identified by its harness and that harness's session id, which the Worker also stores on each session.

When the harness starts and the local list is not empty, the plugin asks the Worker for the parent's sessions and replaces the list with the answer (1 to 3). With an empty list, the plugin makes no call. A forked parent (pi's `/fork`, Claude Code's `/branch` or `--fork-session`) has a new session id, so its first sync returns nothing and its list empties: a fork sees none of the original's remote sessions.

spawn adds a session, close marks it closed, and a prompt that reopens a closed session marks it open again (4, 5). The watch holds a socket for each open session in the list, and every state event updates that session's status (6, 7). A closed session has no socket until a prompt reopens it, which restarts the watch with the session included.

Closed sessions stay in the list and in the list tool's result, so the parent can reopen one. The status line shows only the open sessions (12); a sync that returns a closed session brings it back as closed, hidden from the status line.

A deleted session leaves the list the first time the plugin learns of it: the start-up sync omits it (1 to 3), or any call on it (prompt, messages, close or answer) returns that the session does not exist (8 to 11), or, for an open session, the watch's socket reports that the session does not exist.

> [!NOTE] Why the list is kept both locally and in the Worker
> The local list lets a harness that has never spawned a remote session start without calling the Worker. The Worker's copy lets a harness that does have sessions recover their current status, including changes it missed while it was closed.

> [!WARNING] A deleted session lingers until the plugin learns of it
> The daily cleanup deletes a session without telling its parent. The local list still names the session, and so does the status line if the session was open. This lasts until the next start-up sync, the next call on the session, or, for an open session, the watch's next connection to it.

## 📦 Publishing and installing

The build produces the plugin as two artifacts that ship separately. The pi package goes to npm as `@asermax/pi-tentacles`, and the Claude plugin goes to the repository's `claude-marketplace` branch, which Claude Code reads as a marketplace. Both carry one version, the `version` in `apps/plugin/package.json`. The build writes it into the pi package's manifest, into the Claude plugin's `plugin.json` and into the plugin's entry in `marketplace.json`.

```mermaid
flowchart LR
    Source@{ shape: rect, label: "Plugin source<br/>version in package.json" }
    Build@{ shape: rect, label: "Build<br/>writes the version into each manifest" }
    Pi@{ shape: rect, label: "pi package<br/>@asermax/pi-tentacles" }
    Claude@{ shape: rect, label: "Claude plugin tree<br/>plugin.json and marketplace.json" }
    Npm@{ shape: cyl, label: "npm registry" }
    Branch@{ shape: cyl, label: "claude-marketplace branch<br/>one orphan commit" }
    PiUser@{ shape: stadium, label: "pi install" }
    ClaudeUser@{ shape: stadium, label: "claude plugin marketplace add<br/>and plugin install" }
    Source --> Build
    Build --> Pi
    Build --> Claude
    Pi -->|"npm publish, by CI on a version bump"| Npm
    Claude -->|"force-push, by CI on master"| Branch
    Npm --> PiUser
    Branch --> ClaudeUser

    classDef grey fill:#f3f4f6,stroke:#4b5563,color:#1f2937
    classDef green fill:#dcfce7,stroke:#16a34a,color:#1f2937
    classDef orange fill:#ffedd5,stroke:#ea580c,color:#1f2937
    class PiUser,ClaudeUser grey
    class Source,Build,Pi,Claude green
    class Npm,Branch orange
```

A maintainer releases the pi package by bumping the version. The npm publish script builds the plugin and runs `npm publish` from `apps/plugin/build/out/pi` when npm has no package at that version yet, and otherwise publishes nothing. The package's manifest marks the scoped package as public, names the extension and the skill pi loads, and limits the published files to the extension, the skill, the helper and the README. A user installs it with `pi install npm:@asermax/pi-tentacles`.

The Claude plugin tree is a marketplace. Its `.claude-plugin/marketplace.json` names the marketplace `tentacles` and lists one plugin, also `tentacles`, whose source is the tree's root. The marketplace publish script builds the plugin, commits the tree as a single commit with no parent, and force-pushes that commit to `claude-marketplace`. It stages the commit in a separate git index, so the checkout's index, branch and working tree stay as they were. Given a remote other than `origin`, such as the path of a bare repository, the script pushes there instead. A user adds the marketplace with `claude plugin marketplace add asermax/tentacles@claude-marketplace` and installs the plugin with `claude plugin install tentacles@tentacles`, the plugin's name followed by the marketplace's.

Either install works only against a deployed Worker, with its URL and API key set in `TENTACLES_URL` and `TENTACLES_API_KEY` (see Implementation details).

CI runs on every push and pull request to `master`. Its first job installs bubblewrap and lifts Ubuntu's AppArmor restriction on unprivileged user namespaces, because the core tests' sandbox needs those namespaces. It then installs the dependencies from the frozen lockfile and runs `pnpm check` and `pnpm test`. On a push to `master`, once that job passes, a second job with write access to the repository's contents runs the marketplace publish script, so the marketplace branch holds the plugin as built from the latest `master`. A third job, also on a push to `master` once the first passes, runs the npm publish script. It authenticates with npm's trusted publishing, which exchanges the job's GitHub OIDC token for a publish token. When the package has no trusted publisher, the job uses the `NPM_TOKEN` repository secret instead. It publishes with a provenance attestation.

> [!NOTE] Why the marketplace lives on its own branch
> The marketplace has to be the built tree, with the bundled helper, hooks and skill, and `master` does not commit build output. An orphan branch holds only that tree, and each force-push replaces it whole, so the branch keeps no history of build output.

> [!WARNING] One version number can name different code on the two harnesses
> The marketplace republishes on every push to `master` whether or not the version changed, while CI publishes the npm package only when the version changes. A push that changes the plugin without bumping the version gives Claude Code users code that pi users do not have under the same version, and no check detects the mismatch.

## ⚙️ Implementation details

| Variable | What it sets | Default |
|---|---|---|
| `TENTACLES_URL` | the Worker's URL | required |
| `TENTACLES_API_KEY` | the API key | required |
| `TENTACLES_HELPER` | the helper's path | the bundled helper |
| `TENTACLES_SESSION_PROVIDER` | the model provider | the provider that serves glm-5.2 |
| `TENTACLES_SESSION_MODEL` | the model | glm-5.2 |
| `TENTACLES_SESSION_EFFORT` | the effort level | max |
| `TENTACLES_WORKSPACE_IMAGE` | the workspace image; `default` is the only one tentacles offers | `default` |
| `TENTACLES_WORKSPACE_SIZE` | the workspace container's instance type | basic |
| `TENTACLES_WORKSPACE_LIFETIME` | the workspace's inactivity time, in minutes | 15 |

The helper reads them where it runs, on the developer's machine, except `TENTACLES_HELPER`, which the glue reads to find the helper. The deploy reads its own variables, apart from these.

---

Related: [worker-api](worker-api.md), [question-round-trip](question-round-trip.md), [sessions](sessions.md), [runtime-components](runtime-components.md), [remote-agents](../product-design/remote-agents.md)
