---
title: "Workspace"
summary: "The container a remote agent works in: how it starts and stops, what it holds, the tools the agent gets, and how a preview gives the agent a browser."
created: "2026-11-09"
---

# Workspace

## 🔭 Overview

Each session has one workspace container, started at the first tool call that needs it, from the image, size and lifetime in the session's settings. The agent works in `/workspace`, where tentacles clones the session's repository when the settings name one. The disk is disposable: work survives only once it is committed and pushed, so tentacles holds the container up and prompts the agent while a managed repository has pending work. The agent's tools run in the container through pi-env, and the agent gets a browser only to validate a preview of the app it started.

## 📥 Inputs from the session's settings

| Input | What it is | When absent |
|---|---|---|
| image | the container image | the default image |
| size | the container size | a default size |
| lifetime | inactivity time before the container stops | 15 minutes |
| repository | a repository URL and a shallow-or-full clone flag | nothing is cloned |

The plugin fills every absent value except the repository from its defaults, which environment variables can change, so the session always holds a full set (see [worker-api](worker-api.md)).

## 📦 What the container holds

The default image holds only what tentacles needs: pi-env's daemon, git and CA certificates, with git set up to authenticate through the token added at egress. It has no Node, no Chrome and no Docker. The agent installs anything else it needs, or a client builds its own image and names it in the settings.

The agent always works in `/workspace`. When the settings name a repository, tentacles clones it there, shallow or full as the setting says, on the repository's default branch, when the container starts and again after every restart. Without a repository setting, the agent clones whatever its prompt names. git reaches GitHub with the GitHub token added at egress; the container never holds it (see [runtime-components](runtime-components.md)).

## ⏱️ Lifetime and pending work

The container starts at the first tool call that needs it and stays up while the session is working. Its lifetime is an inactivity time, 15 minutes by default, and every command run in the workspace resets it.

Pending work is anything in the session's repository that is not committed and pushed. tentacles checks for it only when the settings name a repository, since that is the only repository it manages. The check runs at three points: when the question tool asks (see [question-round-trip](question-round-trip.md)), when a run finishes, and when the lifetime is about to run out.

```mermaid
flowchart TD
    A[Lifetime about to run out] --> B{"Repository set and work pending?"}
    B -->|No| S((Container stops))
    B -->|Yes| C{"Run still going?"}
    C -->|Yes| K[Keep the container up, check again]
    K --> A
    C -->|"No: it finished, or close stopped it"| D{"15 minutes since the run stopped?"}
    D -->|No| K
    D -->|Yes| L((Container stops, pending work lost))
```

When a run finishes with pending work, tentacles prompts the agent to commit before the run ends, and the run goes on. It does so up to three times; after the third, the run finishes with the work still pending.

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
| codemode | runs a script that calls the other tools; scripts keep `models.*` (the model catalog, classify and generateImages) through the session's providers |
| subagent | starts a subagent in the foreground, returning its answer, or in the background, to spawn, steer, stop and list; subagents have no question tool |
| question | asks the parent; root conversation only; refuses while the repository has pending work |
| preview | returns a preview URL to a workspace port and a CDP URL to a browser, replacing the open preview if there is one |

The coding tools run in the container through pi-env: the session object reaches pi-env's daemon over the container's exec stdio. codemode is pi-durable's own tool; on Cloudflare it runs in a RemoteCodemodeSandbox. pi-durable ships no subagent tool, so tentacles writes one following pi-durable's examples, and that tool leaves the question tool out of every subagent.

agent-browser is not part of tentacles: it is in the image or the agent installs it, and the agent runs it through bash.

## 🖼️ The preview and the browser

```mermaid
flowchart LR
  agent@{ shape: rect, label: "Remote agent" } -->|"preview"| inp@{ shape: braces, label: "OpenPreview
  port: number
  (the app the agent started in the workspace)" }
  inp --> worker@{ shape: subproc, label: "Worker" }
  worker -.-> out@{ shape: braces, label: "Preview
  url: string
  (token subdomain on the wildcard domain)
  cdpUrl: string
  (a Browser Run browser for agent-browser)" }
  out -.->|"returns"| agent
  classDef worker fill:#dbeafe,stroke:#2563eb,color:#1f2937
  classDef flow fill:#dcfce7,stroke:#16a34a,color:#1f2937
  classDef payload stroke:#d97706
  class agent flow
  class worker worker
  class inp,out payload
```

A session has at most one preview, and only to validate the app in a browser. When the agent wants to check the app it started in the workspace, it calls the preview tool with the app's port. The Worker generates a token, records it and the port on the session's registry entry, opens a Browser Run browser through the binding, and returns two URLs: the preview URL, which carries only the token as a subdomain on a wildcard custom domain, and the browser's CDP URL. The agent points agent-browser at the CDP URL, opens the preview URL, validates what it built and closes the preview.

When the agent calls the preview tool while a preview is open, the new preview replaces it: the previous token stops working and its browser closes.

Anything that is not the app the browser opens, such as an API or a backend, the agent validates inside the workspace with bash, with no preview.

Requests to the preview URL reach the Worker's preview route, which looks up the token and forwards to that port in the workspace. agent-browser's CDP traffic reaches Browser Run through the Worker's relay.

A preview lives only within a run. The browser closes with its preview, when the agent closes the preview or when the run stops by finishing, failing or close. The registry then clears the preview from the session's entry. A later run opens a preview again if it needs one.

> [!TIP] Rejected: a browser inside the workspace container
> Running Chrome in each workspace would put a browser in every image and keep it out of a client's own image unless they add it. Browser Run gives every session the same managed browser, opened by the Worker through the binding with no API token, and the default image stays small.

---

Related: [runtime-components](runtime-components.md), [sessions](sessions.md), [question-round-trip](question-round-trip.md), [worker-api](worker-api.md)
