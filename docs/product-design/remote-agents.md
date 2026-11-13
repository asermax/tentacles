---
title: "Remote agents"
summary: "What it is like for a parent agent, and the person behind it, to dispatch coding agents that run on Cloudflare and follow them through tentacles."
created: "2026-11-09"
---

# Remote agents

## 🔭 Overview

tentacles lets an agent on pi or Claude Code start coding agents that run remotely, on Cloudflare, and work with them the way it works with local subagents: spawn them, prompt and steer them, see when they stop, answer their questions and close them. The parent agent does all of it through a set of tools; nothing of a remote agent runs on the developer's machine. When the parent goes away, a remote agent keeps working and waits on its questions, and the parent finds it when it comes back. Its work survives only through git, so a remote agent commits and pushes what it wants to keep.

## 🚀 Spawning a remote agent

The parent spawns a remote agent with a name, a first prompt and its settings: the provider, the model, the effort level, the container image, size and lifetime, and optionally a repository to work on. The name is required; the status line and the list show the remote agent by its name. Any setting the parent leaves out takes the plugin's default, which the person can change through environment variables. The agent starts working on the first prompt at once.

With a repository in its settings, the remote agent starts with it cloned. Without one, it clones whatever its prompt names. Claude models run on the person's own Claude subscription, and models from other providers are available too.

[workspace](../technical-design/workspace.md) covers the container's image, clone and lifetime.

The parent can also give the remote agent skills and agent definitions, by passing their folder and file paths at spawn. They are fixed for the remote agent's life, so the parent includes every one the job needs, and work that needs a different set goes to a new remote agent. The plugin checks every skill and agent definition on the developer's machine before anything is sent; when one fails, spawn returns every problem with its path, skills and agents listed apart, and no remote agent starts.

## 💬 Prompting and steering

While a remote agent works, the parent can send it a prompt as a follow-up, which the agent takes up after its current turn, or as a steer, which redirects it mid-run. A prompt to an agent that has finished starts it working again.

Nobody watches a remote agent live. The parent reads what it did through the messages tool: its last message by default, or the last N, where a message is any entry of its conversation (prompts, its text, tool calls and results, subagent results). On pi, the parent can also block on a remote agent with the wait tool.

A prompt can name one of the remote agent's skills, as `/skill:<name>` or `/<name>` anywhere in its text. The remote agent receives a short block in its place that points at the skill's instructions, and reads the instructions before acting on the skill. A name the remote agent does not hold stays as written.

## 📊 The status line

The harness shows a status line with the name and status of each open remote agent: running, waiting on a question, idle or failed. The status line hides closed ones, but the list tool still returns them.

The list belongs to the parent's harness session. When the harness reopens that session, the plugin refreshes the list from tentacles, so the status line shows each agent's current status, including changes made while the parent was away. A forked parent starts with no remote agents of its own.

The list also returns each remote agent's settings and the names of its skills and agents, so a parent that comes back later knows what each remote agent can do.

## ⏰ Finish and failure wakes

When a remote agent's run finishes, the plugin wakes the parent with that agent's last message, so the parent can read the result without another call. When a run fails on an error the agent cannot recover from, the plugin wakes the parent with the failure. In both cases the remote agent stays available: a prompt starts it on a new run.

Before a run finishes, tentacles reminds a remote agent working on a repository to commit and push anything it left behind.

> [!WARNING] A headless parent is never woken
> A parent running headless (`claude -p`) gets no wake, as with local subagents. It learns that a remote agent finished or asked something only by calling the tools.

## 🧩 Skills and agents inside a remote agent

A remote agent sees its skills and agent definitions by name and description, and loads a skill when a task matches it, reading its instructions and the files they point to. It installs whatever a skill needs to run in its workspace. It can start subagents from its agent definitions by name, and those subagents can start subagents of their own, which cannot start any. A remote agent running a skill works on its own. Where a skill would stop to ask the person, the parent's handoff tells it to decide and report what it decided at the end. For a stop point it cannot decide, such as a missing credential, the handoff says what to do, which can be asking the parent with the question tool. The plugin's skill teaches the parent to write that handoff. [sessions](../technical-design/sessions.md) covers how the skills and agents reach the remote agent.

## ❓ Questions

A remote agent can ask its parent a question when it needs a decision. Before it asks, it commits and pushes its work, so the question can wait any length of time and the work survives the container stopping.

The plugin wakes the parent with the question itself. It can answer on its own or show the question to the person and answer when they reply, which can be much later. The parent answers with the answer tool, and the remote agent continues from where it asked. A prompt sent while a question waits does not answer the question; the prompt reaches the agent after the answer.

Only the remote agent itself asks; subagents it starts inside its session cannot. [question-round-trip](../technical-design/question-round-trip.md) follows a question from the tool to the parent and back.

## 🛑 Closing and reopening

Closing a remote agent stops whatever it is doing. A closed agent leaves the status line but stays in the list, and its messages and status stay readable. A prompt to a closed agent reopens it and starts it working again.

## 🗑️ Deleted remote agents

tentacles deletes a remote agent a month after its last run stopped, whether it finished, failed or was closed. Reading its messages or status does not extend the month, and an agent that is working or waiting on a question is never deleted. Branches it pushed stay on GitHub.

tentacles does not tell the parent. The remote agent leaves the parent's list the first time the plugin notices: when the harness reopens the session, or when a call on the agent returns that the agent does not exist. Until then it can still appear in the list and the status line.

## 🖼️ A preview for validation

A remote agent can check the app it starts in a browser by opening a preview of it: a private URL to its port, together with a browser it drives with agent-browser. It opens the preview, checks what it built and closes it. An agent has one preview at a time; opening another replaces the open one. Other checks, such as calling an API, happen inside the agent's workspace with no preview. The preview closes when the agent's run stops, so it is the agent's way to check its own work, not something the parent or the person browses later. The remote agent has no browser for any other page.

---

Related: [plugin](../technical-design/plugin.md), [sessions](../technical-design/sessions.md), [question-round-trip](../technical-design/question-round-trip.md), [workspace](../technical-design/workspace.md), [worker-api](../technical-design/worker-api.md)
