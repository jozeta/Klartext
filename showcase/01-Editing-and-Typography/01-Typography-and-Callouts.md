---
title: Typography, Callouts & Wiki-Links
author: Klartext Design System
category: Typography
tags:
  - typography
  - callouts
  - live-preview
---

# Typography, Callouts & Wiki-Links

Klartext features a **Technical Nordic** aesthetic designed for distraction-free long-form engineering and research documentation.

## Inline Formatting & Emphasis

You can combine **bold statements**, *italicized nuance*, ~~deprecated strikethroughs~~, and `inline monospaced tokens` seamlessly. When editing in **Inline Rich Mode**, raw Markdown tokens automatically hide on inactive lines and reveal themselves on the active cursor line.

## GitHub-Flavored Callout Blocks

> [!NOTE] Architectural Note
> Callouts render with semantic Nordic border accents in both **Inline Rich Mode** and **Split View Mode**.

> [!TIP] Keyboard-First Workflow
> Select any text in the editor to summon the **Floating Formatting Bar** for instant headings, tables, checklists, or visual diagrams.

> [!IMPORTANT] Per-Root Asset Isolation
> Every mounted workspace folder maintains its own self-contained `assets/` directory.

> [!WARNING] External File Modifications
> Klartext watches all mounted roots via `chokidar` and reloads clean buffers automatically.

> [!CAUTION] Hardened Security Boundary
> All HTML previews, SVGs, and Mermaid diagrams are sanitized through strict DOMPurify and CSP policies.

## Cross-Document Wiki-Links & Backlinks

Link to any note using standard Markdown links or Wiki-link syntax such as [[Welcome]] or [[01-Mermaid-Diagrams]]. Open the **Links** icon in the left sidebar control bar to inspect incoming backlinks.
