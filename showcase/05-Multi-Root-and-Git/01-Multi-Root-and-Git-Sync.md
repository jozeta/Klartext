---
title: Multi-Root Workspaces & Concurrent Git Sync
author: Platform Engineering
category: Git & Workspaces
tags:
  - multi-root
  - git
  - conflict-resolution
---

# Multi-Root Workspaces & Concurrent Git Sync

## Mounting Multiple Folders

1. Click the **`+` (Mount Root by Path)** or **Folder+** icon in the Left Sidebar header to mount additional project directories into a single workspace.
2. Save or load portable `.klartext-workspace` JSON manifests via **File → Settings...**.
3. Moving a Markdown document between roots automatically checks for referenced images/drawings in `assets/` and offers to migrate them and rewrite relative links.

## Concurrent Multi-Repository Git

Switch to the **Git** icon in the bottom-left sidebar control bar to view independent repository statuses across every mounted root:
- **Sync All** executes `fetch -> pull --rebase -> push` concurrently across all repositories.
- If a merge conflict occurs in one repository, other repositories still complete cleanly, and Klartext renders one-click conflict resolution lenses (**Accept Current**, **Accept Incoming**, **Accept Both**).
