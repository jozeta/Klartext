---
title: Typography, Callouts & Frontmatter Showcase
author: Johan Lindqvist
status: published
category: Design System
version: 1.0
---

# 01. Typography, Callouts & Frontmatter

Welcome to the **Klartext Feature Showcase**. Try switching between **Source**, **Inline Rich**, and **Split** modes in the top bar, or click **Edit Properties** above to edit the YAML frontmatter interactively!

## 1. Inline Formatting & Lists

- **Bold text** for strong emphasis and *italic text* for subtle nuance.
- ~~Strikethrough text~~ for deprecated items and `inline code` for symbols like `MultiRootPathGuard`.
- Connected via WikiLinks to [[02-Tables-and-TaskLists|02. Tables & Task Lists]] and [[03-Math-and-CodeBlocks|03. Math & Code]].

### Interactive Task List (Click checkboxes in Inline Rich Mode!)
- [x] Verify Technical Nordic Light & Dark themes
- [x] Test collapsible Left Sidebar (`Cmd/Ctrl + B`) and Zen Mode (`Cmd/Ctrl + Shift + F`)
- [ ] Click this unchecked task box directly in the editor
- [ ] Open the Outline & Backlinks tabs in the Left Sidebar

---

## 2. GitHub & Obsidian Callouts / Admonitions

> [!NOTE] Architectural Note
> Klartext maintains a single CodeMirror 6 document buffer across all editing modes so undo/redo history is never lost.

> [!TIP] Productivity Shortcut
> Press `Cmd/Ctrl + K` to open the Command Palette or `Cmd/Ctrl + P` to fuzzy-switch between all test files.

> [!IMPORTANT] Per-Root Asset Portability
> Any image pasted or dropped into this file is saved strictly inside `assets/images/` of this root folder.

> [!WARNING] Cross-Repository WikiLinks
> Linking across separate Git repositories displays a visual badge warning if the target repository is not mounted.

> [!CAUTION] Security Boundary
> Raw `<script>` tags and `javascript:` links are strictly stripped by the sanitization pipeline.
