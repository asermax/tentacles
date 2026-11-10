---
title: "tentacles: invariants"
summary: "The rules every change to tentacles respects."
---

# tentacles: invariants

Each line is one rule. A rule is one sentence and links to the note that explains it, when one does. To make a change that breaks a rule, change the rule here first.

The sections below are the usual kinds of rule. Keep the ones this project has rules for, delete the others, and add a section when a rule fits none of them.

## 🧭 Product behaviour

- A prompt never answers or cancels a waiting question; it reaches the agent after the answer ([question-round-trip](technical-design/question-round-trip.md)).
- Deletion never touches a running or waiting session ([sessions](technical-design/sessions.md)).
- Before an action that pauses a session, asking a question or ending a run, tentacles checks the session's repository for work that is not committed and pushed ([question-round-trip](technical-design/question-round-trip.md), [workspace](technical-design/workspace.md)).
- A session's status changes only in reaction to its pi-durable session ([sessions](technical-design/sessions.md)).

## 🖥️ Interface

- The plugin talks to tentacles only through the Worker API and the session socket ([plugin](technical-design/plugin.md)).

## 🏗️ System

- A session's alarm belongs to pi-durable, to resume a run after an eviction; nothing else schedules on it ([sessions](technical-design/sessions.md)).
- tentacles' shared logic depends on the provider contracts, never on a provider directly ([runtime-components](technical-design/runtime-components.md)).

## 💽 Data

- Work survives only once it is committed and pushed; a workspace's disk is disposable ([workspace](technical-design/workspace.md)).

## 🔒 Access and security

- Credentials never enter a container; they are added to outgoing requests at egress ([runtime-components](technical-design/runtime-components.md)).
