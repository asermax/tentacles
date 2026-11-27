---
title: "Question round trip"
summary: "How a remote agent's question travels from its question tool to the parent agent, and how the answer resolves the waiting tool call."
created: "2026-11-09"
---

# Question round trip

## 🔭 Overview

A remote agent asks its parent through its question tool, `ask_parent`, which waits inside the run. The session stores the question and moves to waiting, the session socket carries it to the plugin's helper, and the helper wakes the parent with the question itself. The parent answers, by itself or after asking the person behind it, and the answer resolves the waiting tool call so the run continues. Only the root conversation's model can ask, never a codemode script. The question waits as long as the parent takes: the workspace's files live with the session, so nothing the agent left unpushed is lost while it waits.

## 📩 Flow

```mermaid
sequenceDiagram
    autonumber
    participant A as Remote agent
    participant T as Question tool
    participant S as Session
    participant H as Plugin helper
    participant P as Parent agent
    actor Pe as Person
    participant W as Worker
    A->>T: asks
    T->>S: store the question, move to waiting
    S->>H: session state with the question
    H->>P: wake with the question
    opt the parent asks the person
        P->>Pe: shows the question
        Pe-->>P: the answer
    end
    P->>W: answer tool, by question id
    W->>S: answer
    S-->>A: the tool returns, the run continues
```

1. The agent calls the question tool.

> [!NOTE] Only the root conversation asks
> Subagent conversations inside the session do not get the question tool. A child conversation starts with a copy of its owner's extensions, and the question tool belongs to an extension only the root has. The subagent tool leaves that extension out of every copy. The parent reads only the root conversation, so a question from work it never sees would arrive without context.

2. The session stores the question, its id and its text, and moves to waiting.
3. The socket sends the session state with the question to the plugin's helper.
4. The helper wakes the parent with the question itself: the session, the question id and the text, so the parent can answer without another call.
5. and 6. The parent answers it itself, or shows it to the person and answers when they reply.
7. and 8. The parent answers with the answer tool, by the question's id, through the Worker.
9. The answer resolves the waiting tool call and the run continues. The socket sends the new state.

A prompt sent while a question waits is a steer whatever mode the parent sends it with, and reaches the agent after the answer; a prompt neither answers nor cancels the question. A question keeps its id when an eviction makes the tool run again, so an answer sent for it still resolves it. Every eviction cuts the waiting tool call off, and pi-durable counts each cut-off toward its restart limit. The session lifts that limit while the question's call is live, so the question survives any number of evictions. An answer to a question that is not waiting returns an error, which the parent sees as a tool failure.

> [!WARNING] No socket open when the question arrives
> When the parent's helper is not connected (the harness is closed, or the parent runs headless), nothing wakes the parent. The question keeps waiting in the session and arrives with the state on the next connection; until then the run stays waiting and the session is never deleted.

---

Related: [sessions](sessions.md), [worker-api](worker-api.md), [workspace](workspace.md), [plugin](plugin.md), [remote-agents](../product-design/remote-agents.md)
