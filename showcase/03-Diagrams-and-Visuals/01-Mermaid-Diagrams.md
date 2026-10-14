---
title: Interactive Mermaid Diagrams & Visual Builder
author: Systems Architecture
category: Diagrams
tags:
  - mermaid
  - diagrams
  - visual-builder
---

# Interactive Mermaid Diagrams & Visual Builder

Click the **Visual Builder** button on any Mermaid diagram below—or click the **Visual Diagram Builder** icon in the floating formatting bar—to draw nodes and arrows on an auto-expanding 2D canvas.

## 1. Multi-Root Architecture Flowchart

```mermaid
flowchart LR
    UI["React + CodeMirror 6"] --> IPC["Typed ContextBridge IPC"]
    IPC --> WS["Multi-Root Registry"]
    IPC --> GIT["Concurrent Git Manager"]
    IPC --> AI["Local AI (127.0.0.1)"]
```

## 2. Concurrent Git Synchronization Sequence

```mermaid
sequenceDiagram
    participant User
    participant Renderer
    participant GitManager
    participant RepoA as Repo A (Docs)
    participant RepoB as Repo B (Specs)
    User->>Renderer: Click "Sync All Repos"
    Renderer->>GitManager: gitSyncAll()
    par Concurrent Execution
        GitManager->>RepoA: fetch -> pull --rebase -> push
        GitManager->>RepoB: fetch -> pull --rebase -> push
    end
    GitManager-->>Renderer: Per-Repo Status & Conflict Hunks
```

## 3. Document Lifecycle State Diagram

```mermaid
stateDiagram-v2
    [*] --> CleanBuffer
    CleanBuffer --> DirtyBuffer: User Edits Markdown
    DirtyBuffer --> SnapshotSaved: 900ms Debounce
    SnapshotSaved --> CleanBuffer: Atomic Disk Write
```
