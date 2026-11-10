# Remote agents

Remote agents are coding-agent sessions that run in tentacles, away from your machine. Each one has its own workspace, with the repository you name in its settings cloned into it, and the agent keeps running after you close your session. You reach them only through the tentacles tools. You cannot read their screen, type into them, or see their files.

{{invoke}}

## When to send work to a remote agent

Send a remote agent work that is separable and long: a feature on its own branch, a migration, an investigation that needs a clean checkout. Each one costs a container and a model, so prefer a few remote agents with clear tasks over many small ones.

A remote agent only keeps what it commits and pushes. Its workspace is disposable, so give it a repository it can push to, and ask for the result as a branch or a pull request, not as files.

## Spawn

`spawn` takes a name, the first prompt and the session's settings. The name shows in your status line, so name it after the agent's task. The settings you leave out come from the plugin's defaults.

Write the first prompt for someone who has not seen this conversation: the goal, the repository, the branch to push, and what done looks like. Name the repository in the settings when the agent has to work in it, so tentacles clones the repository and, before the agent asks you anything, checks it for work that is not pushed.

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

`list` returns every remote agent you started from this session, closed ones included, with its status. A forked session starts with none.
