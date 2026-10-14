---
title: Interactive Git Merge Conflict Sandbox
conflictState: simulated
---

# 06. Interactive Git Merge Conflict Sandbox

This file contains live Git conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) so you can immediately test Klartext's **Conflict Navigator Bar**, **Inline Conflict Action Lenses**, and **3-Way Diff View** without needing to trigger a remote Git failure first!

> [!TIP] Try Resolving Below!
> Click **Accept Current (Local)**, **Accept Incoming (Remote)**, **Accept Both**, or **Open 3-Way Diff View** on the conflict banners below.

## Conflict Hunk #1 — Architecture Summary

<<<<<<< HEAD
### Lokal Version (Svenska)
Klartext kör alla filsystemoperationer och lokala AI-anrop i Electron Main Process bakom validerade Zod-scheman.
=======
### Incoming Version (English)
Klartext executes all filesystem operations and local AI requests inside the Electron Main Process behind validated Zod schemas.
>>>>>>> origin/main

## Conflict Hunk #2 — Default Sync Policy

<<<<<<< HEAD
- Default Pull Strategy: `rebase`
- Background Auto-Fetch Interval: `180 seconds`
=======
- Default Pull Strategy: `merge`
- Background Auto-Fetch Interval: `300 seconds`
>>>>>>> feature/sync-settings

See also [[01-Typography-and-Callouts]] and [[04-Diagrams-Mermaid-Excalidraw]].
