---
name: tentacles
description: Send separable, long work to remote agents that run in tentacles, and steer, question and collect them.
---
# Remote agents

Remote agents are coding-agent sessions that run in tentacles, away from your machine. Each one has its own workspace, with the repository you name in its settings cloned into it, and the agent keeps running after you close your session. You reach them only through the tentacles tools. You cannot read their screen, type into them, or see their files.

Use the tentacles tools: `mcp__tentacles__spawn`, `mcp__tentacles__prompt`, `mcp__tentacles__messages`, `mcp__tentacles__list`, `mcp__tentacles__close` and `mcp__tentacles__answer`.

## When to send work to a remote agent

Send a remote agent work that is separable and long: a feature on its own branch, a migration, an investigation that needs a clean checkout. Each one costs a container and a model, so prefer a few remote agents with clear tasks over many small ones.

A remote agent only keeps what it commits and pushes. Its workspace is disposable, so give it a repository it can push to, and ask for the result as a branch or a pull request, not as files.

## Spawn

`spawn` takes a name, the first prompt, the session's settings and, optionally, skills, agent definitions and context files (see Skills and agents, and Context files). The name shows in your status line, so name it after the agent's task. The settings you leave out come from the plugin's defaults.

Write the first prompt for someone who has not seen this conversation: the goal, the repository, the branch to push, and what done looks like. Name the repository in the settings when the agent has to work in it, so tentacles clones the repository and, before the agent asks you anything, checks it for work that is not pushed.

## Skills and agents

`spawn` takes `skills`, the paths of skill folders on your machine, each holding a `SKILL.md`, and `agents`, the paths of agent definition files. The remote agent sees each skill and agent by name and description, loads a skill when a task matches it, and starts subagents from its agent definitions by name. A prompt can name a skill as `/skill:<name>` or `/<name>` on its own, with a space or the start or end of the prompt on each side, and the remote agent reads that skill's instructions before acting on it.

Skills and agents are fixed at spawn. Include everything the job needs, and spawn a new remote agent when the job needs a different set.

Every definition is checked on your machine before anything is sent. When any fails, `spawn` creates nothing and returns every problem with its path, the skills' problems in one group and the agents' in another. Fix them all, then spawn again. An agent definition's frontmatter `name` has to equal its file name without `.md`.

A remote agent works on its own, so a skill that would stop to ask the person has nobody to ask. Write the handoff so the remote agent decides wherever a skill would stop for the user, ignores any instruction in a skill to ask the user, and lists every such decision in its final report. For a stop point it cannot decide, such as a credential it lacks, say in the handoff what to do, which can be asking you with its question tool.

## Context files

`spawn` takes `context`, the paths of files and folders on your machine that the job needs and the repository does not hold, such as a change's scratch files. Each path lands in the remote agent's `/context` folder under its own name: a file at `/context/<file name>`, a folder at `/context/<folder name>/…`. `/context` is outside the repository, so the files never reach its commits. A folder takes everything under it, a symlink is sent as the file or folder it points to, and every file keeps its permission bits.

The remote agent has a copy that is fixed at spawn. Its edits to the copy are lost when its workspace restarts and never come back to you, so spawn a new remote agent when the job needs different files. The remote agent is told only that you sent files and that they are in `/context`, so say in the handoff what the files are and how to use them.

The paths are checked on your machine before anything is sent. A path that does not exist or cannot be read, two paths with the same name, or files that pack over 5 MB make `spawn` create nothing and return every problem with its path in a Context group, beside the Skills and Agents groups.

## Being woken

You are woken when a remote agent stops. The wake carries the agent's last message when it finishes, the reason when it fails, and the question when it asks one. You never poll. If you think a wake was missed, run `list`.

## Questions

A remote agent asks with its question tool and waits for the answer. Answer with `answer`, passing the question's id. Answer it yourself when you can; when the decision is the human's, ask them and answer once they reply. A prompt you send while a question waits does not answer the question. The agent receives the prompt after the question is answered.

## Prompt

`prompt` sends a follow-up or a steer. A follow-up waits for the current run to end; a steer reaches the agent at its next step. Prompting a closed session reopens it.

## Messages

`messages` returns the last entries of the agent's conversation, the last one by default. Read the last message before judging a result, and ask for more only when you need the steps that led to it.

## Close

Close a remote agent once you have its result. Closing aborts what it is doing and hides it from your status line. It stays in `list`, and for a month after its last run you can reopen it with a prompt.

## Listing remote agents

`list` returns every remote agent you started from this session, closed ones included, with its status, its settings and the names of its skills and agents. A forked session starts with none.
