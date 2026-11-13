---
title: "Workspace"
summary: "The container a remote agent works in: how it starts and stops, what it holds, the tools the agent gets, and how a preview gives the agent a browser."
created: "2026-11-09"
---

# Workspace

## 🔭 Overview

Each session has one workspace container, started by the first file or command operation of a tool call, from the image, size and lifetime in the session's settings. The agent works in `/workspace`, where tentacles clones the session's repository when the settings name one, and finds the session's skills in `/skills`. The disk is disposable: work survives only once it is committed and pushed, so tentacles holds the container up and prompts the agent while a managed repository has pending work. The agent's tools run in the container through pi-env, and the agent gets a browser only to validate a preview of the app it started.

## 📥 Inputs from the session's settings

| Input | What it is | When absent |
|---|---|---|
| image | the container image: `default`, the only image tentacles offers; create rejects any other | `default` |
| size | the container's instance type | basic |
| lifetime | inactivity time before the container stops | 15 minutes |
| repository | an `https://` (or `http://`) repository URL and a shallow-or-full clone flag; create rejects any other URL form | nothing is cloned |

The plugin fills every absent value except the repository from its defaults, which environment variables can change, so the session always holds a full set (see [worker-api](worker-api.md)).

## 📦 What the container holds

The default image holds only what tentacles needs: pi-env's daemon, git and CA certificates, with git set up to authenticate through the token added at egress, and a small process that pings the session with busybox `wget` to keep the container up while work is pending (see below). It has no Node, no Chrome and no Docker. The agent installs anything else it needs.

The agent always works in `/workspace`. The first file or command operation of each tool call makes sure the workspace is up. pi-durable also asks for the execution environment to render prompt sections, and that request alone does not start the container. When the container is not running, tentacles starts it and waits until it is ready. When the settings name a repository, tentacles then clones the repository's default branch there, shallow or full as the setting says. When the session holds skills, tentacles then copies the skills archive into the container and expands it into `/skills`, one folder per skill. When the clone, copy or expansion fails, the tool call that needed the workspace fails with "workspace unavailable". The container stays running, and later tool calls use it as it is. Nothing clones or expands again until the container next starts cold (see [sessions](sessions.md)). When the clone and the expansion succeed, the first tool call and the first one after a restart, even in the middle of a run, find the repository and the skills in place. Without a repository setting, the agent clones whatever its prompt names. git reaches GitHub with the GitHub token added at egress; the container never holds it (see [runtime-components](runtime-components.md)).

## ⏱️ Lifetime and pending work

The container starts on the first operation of a tool call and stays up while the session is working. Its lifetime is an inactivity time, 15 minutes by default, and every command run in the workspace resets it.

The workspace keeps itself up while it has pending work. A small process in the image checks `git status` in `/workspace` and, while work is pending, pings the session once a minute with `GET http://tentacles.internal/lifetime?pendingWork=true`, which the container's outbound handler routes to its own session. The session answers `yes` or `no` by the rule in the flowchart below, and answers `no` when the settings name no repository. Each ping that reaches the session renews the container. After a `no`, the process stops pinging, and the inactivity time stops the container. The session schedules no check of its own, so pi-durable keeps sole use of the session's alarm.

Pending work is anything in the session's repository that is not committed and pushed. tentacles checks for it only when the settings name a repository, since that is the only repository it manages. The check runs at three points: when the question tool asks (see [question-round-trip](question-round-trip.md)), when a run finishes, and whenever the workspace pings while it has pending work.

```mermaid
flowchart TD
    A["The workspace pings: work pending"] --> B{"Repository set and work pending?"}
    B -->|No| S(("No: the pings stop,<br/>the container stops"))
    B -->|Yes| C{"Run still going?"}
    C -->|Yes| K["Yes: the ping renews the container"]
    K --> A
    C -->|"No: it finished, or close stopped it"| D{"15 minutes since the run stopped?"}
    D -->|No| K
    D -->|Yes| L((Container stops, pending work lost))
```

When a run finishes with pending work, tentacles prompts the agent to commit before the run ends, and the run goes on. It does so up to three times; after the third, the run finishes with the work still pending. When the container is not running as a run finishes, tentacles skips the check and does not start the container: a stopped container's disk holds no work.

When the lifetime runs out with pending work during a run, tentacles keeps the container up and checks again. Once the run has finished, pending work keeps the container up for 15 more minutes only; then the container stops.

> [!WARNING] Pending work is lost 15 minutes after the run finishes
> If the agent ignores all three commit prompts, its uncommitted or unpushed work stays only on the container's disk. Fifteen minutes after the run finishes the container stops and the work is gone. The run finishes as any other run does, so a parent that expects a pushed branch should check for it.

tentacles sends the commit prompts when a run finishes and closes the preview when a run stops, however much lifetime is left.

Closing a session stops its run. Without pending work, the container then stops once its lifetime passes. With pending work, the container stays up for 15 more minutes after the close, then stops and the work is lost, as after a finished run.

## 🧰 The agent's tools

| Tool | What it does |
|---|---|
| read, write, edit | work on files in `/workspace`, through pi-env |
| bash | runs commands in the workspace; agent-browser runs through it |
| codemode | runs a script that calls the other tools except `ask_parent`; scripts keep `models.*` (the model catalog, classify and generateImages) through the session's providers |
| subagent | starts a subagent in the foreground, returning its answer, or in the background, to spawn, steer, stop and list; run and spawn take an optional agent name, and the subagent then starts with that agent definition's prompt. The root and its children have the tool, so a child can start subagents of its own; a grandchild cannot |
| skill | given the name of one of the session's skills, returns a block pointing at its SKILL.md in `/skills`, which the agent then reads; an unknown name fails, naming the skills that exist |
| ask_parent | asks the parent; root conversation only, and only the model calls it; while the repository has pending work, returns a refusal with the repository's status |
| preview | opens a preview, returning a preview URL to a workspace port and a CDP URL to a browser and replacing the open preview if there is one; or closes the open preview |

The coding tools run in the container through pi-env: the session object reaches pi-env's daemon over the container's exec stdio. codemode is pi-durable's own tool; on Cloudflare it runs in a RemoteCodemodeSandbox. pi-durable ships no subagent tool, so tentacles writes one following pi-durable's examples. The subagent tool and the skill tool each belong to an extension of their own, described in [sessions](sessions.md); a subagent never gets `ask_parent`.

The model reads each tool's result as text. Only the model calls `ask_parent`: a script's tool call runs as a nested task, which the session does not watch when it derives its status, so a question asked from a script would never show the session as waiting. preview also returns a tagged structured result to a program that calls it, such as a codemode script: `open` with the preview URL and the CDP URL, or `close`.

agent-browser is not part of tentacles: the agent installs it and runs it through bash.

## 🖼️ The preview and the browser

```mermaid
flowchart LR
  agent@{ shape: rect, label: "Remote agent" } -->|"preview"| inp@{ shape: braces, label: "OpenPreview
  port: number
  (the app the agent started in the workspace)" }
  inp --> session@{ shape: subproc, label: "Session object" }
  session -.-> out@{ shape: braces, label: "Preview
  url: string
  (token subdomain on the wildcard domain)
  cdpUrl: string
  (a Browser Run browser for agent-browser)" }
  out -.->|"returns"| agent
  classDef session fill:#dbeafe,stroke:#2563eb,color:#1f2937
  classDef flow fill:#dcfce7,stroke:#16a34a,color:#1f2937
  classDef payload stroke:#d97706
  class agent flow
  class session session
  class inp,out payload
```

A session has at most one preview, and only to validate the app in a browser. When the agent wants to check the app it started in the workspace, it calls the preview tool with the app's port. The tool runs in the session object, which opens a Browser Run browser through its own binding. The registry then generates a token, records it and the port on the session's entry and returns the token. The tool returns two URLs: the preview URL, `https://<token>-tentacles-preview.asermax.com`, which carries only the token, and the browser's CDP URL, which carries a token signed with the secret the Worker's CDP relay checks. The agent points agent-browser at the CDP URL, opens the preview URL, validates what it built and closes the preview. Closing the preview clears its token, so the preview URL stops working. It also closes the preview's browser.

When the agent calls the preview tool while a preview is open, the new preview replaces it: the previous token stops working and its browser closes.

Anything that is not the app the browser opens, such as an API or a backend, the agent validates inside the workspace with bash, with no preview.

Requests to the preview URL reach the Worker's preview route, which looks up the token and forwards to that port in the workspace. agent-browser's CDP traffic reaches Browser Run through the Worker's relay.

A preview lives only within a run. The browser closes with its preview, when the agent closes the preview or when the run stops by finishing, failing or close. The registry then clears the preview from the session's entry. A later run opens a preview again if it needs one.

> [!TIP] Rejected: a browser inside the workspace container
> Running Chrome in each workspace would put a browser in the image every session starts from. Browser Run gives every session the same managed browser, opened by the session object through its binding with no API token, and the default image stays small.

---

Related: [runtime-components](runtime-components.md), [sessions](sessions.md), [question-round-trip](question-round-trip.md), [worker-api](worker-api.md)
