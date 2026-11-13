---
title: "Worker API"
summary: "The calls the Worker exposes to the plugin's helper, the per-session socket, and the session state both return."
created: "2026-11-09"
---

# Worker API

## 🔭 Overview

The Worker's API is the plugin's only way to reach tentacles: seven calls (create, prompt, answer, close, messages, status, list) and one socket per session. Every request and every socket carries the API key, and the plugin reads the Worker's URL and the key from environment variables. The socket sends one construct, the session state, when it connects and again on every change, and the status call returns the same construct. Calls on an existing session succeed, closed ones included; a deleted or unknown session returns an error.

## ♠️ What it exposes

| Member | Takes | Answers | Who asks |
|---|---|---|---|
| `create` | the name, the parent, the settings, the first prompt, and optionally a skills archive and an agents archive (see below) | starts the session, stores its skills and agent definitions, waits until its first run has started and returns its session id | the spawn tool |
| `prompt` | the session id, the text, and a mode: follow-up or steer | sends the text to the session; on an idle, failed or closed session it starts a new run, reopening a closed one; a prompt sent while a question waits is a steer whatever its mode, and queues until the answer | the prompt tool |
| `answer` | the session id, the question id and the answer text | resolves the waiting question, and the run continues | the answer tool |
| `close` | the session id | aborts whatever the session is doing and closes it | the close tool |
| `messages` | the session id and a count, 1 when absent | the last entries of the root conversation, as many as the count | the messages tool |
| `status` | the session id | the session state at any time | the plugin, when it needs one session's state |
| `list` | the parent | all of the parent's sessions from the registry, closed ones included, each with its id, name, status, settings and the names of its skills and agents | the list tool and the start-up sync |
| socket | the session id, on connect | the session state on connect and on every change | the helper's watch, one socket per session |

A message is any entry in the root conversation's history: a user prompt, the agent's text, a tool call or its result, a subagent's result. The last N messages are the last N entries, returned unshortened; the calling agent handles their length. `messages` does not read subagent conversations.

The registry entry carries each session's name, status, settings and skill and agent names, so `list` answers without a call per session.

A call or a socket on a deleted or unknown session, or an answer to a question that is not waiting, returns an error with a message. The plugin hands that message to the parent agent as a tool failure.

## 🚀 What create takes

| Input | What it holds |
|---|---|
| name | required; the status line shows the session by it |
| parent | the parent's harness (pi or claude) and that harness's session id |
| settings | provider, model, effort, image, size and lifetime, and optionally a repository: its URL and a shallow-or-full clone flag |
| prompt | the first prompt; the run starts on it |
| skills | optional; a gzip-compressed tar file of at most 5 MB with one skill folder per top-level entry |
| agents | optional; a gzip-compressed tar file of at most 5 MB with one agent definition file per top-level entry |

The plugin fills every unset setting from its defaults, so create always carries provider, model, effort, image, size and lifetime. A repository is optional; tentacles clones it into `/workspace` (see [workspace](workspace.md)).

The plugin's helper checks the skills and agent definitions on the parent's machine and packs the archives only when every check passes, so a problem reaches the parent as the spawn tool's result and never as a create call. [sessions](sessions.md) covers the checks, in its Skills and agents section, and what the session does with each archive.

## 📡 Session state

The session state carries the session's status (running, waiting, idle, failed or closed), its settings, the names of its skills and agents, the question while one waits (its id and text), and the failure when the last run failed. When a run just finished, the state also carries the run's last entry, so the finish wake needs no messages call. A session already idle when the socket connects sends its state without the last entry, and the helper fetches it with `messages`. The socket sends the state when it connects and again on every change; status returns it too. [sessions](sessions.md) lists the states and the events that move a session between them.

> [!NOTE] Why the session state is one construct
> The finish notice, a new question, the status line, a reconnecting parent and the status call all read the same state, so each of them sees the same session, and a parent that was not connected when something changed learns it from the state sent on connect.

---

Related: [runtime-components](runtime-components.md), [sessions](sessions.md), [question-round-trip](question-round-trip.md), [plugin](plugin.md)
