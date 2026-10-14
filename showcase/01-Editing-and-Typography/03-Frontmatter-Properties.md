---
title: Frontmatter Properties Showcase
author: Johan Zetterström
date: 2026-10-14
status: Approved
version: 1.0.0
reviewers: Architecture Board
tags:
  - frontmatter
  - yaml
  - metadata
---

# Frontmatter Properties Window

Click the **Toggle Right Panel** button in the top-right titlebar (or choose **View → Show Right Frontmatter Window**) to inspect and edit this document's YAML frontmatter in a dedicated, resizable properties inspector.

## How Frontmatter Sync Works

1. **Two-Way Binding:** Updating any field in the right-hand **Frontmatter Properties** panel immediately updates the YAML header block at the top of the Markdown file.
2. **Custom Keys:** Add custom metadata fields (such as `version`, `reviewers`, or `project`) directly from the panel.
3. **Hidden in Inline Rich Mode:** Raw YAML frontmatter delimiters (`---`) collapse into a compact metadata badge in Inline Rich Mode so your reading flow stays clean.
