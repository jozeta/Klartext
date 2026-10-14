---
title: GFM Tables, Checklists & Data Matrix
owner: Platform Team
reviewed: true
---

# 02. GFM Tables & Project Checklists

This document links back to [[01-Typography-and-Callouts]] and forward to [[04-Diagrams-Mermaid-Excalidraw]].

## 1. Performance Budget Matrix

| Subsystem | Target Metric | Reference Result | Status |
| :--- | :--- | :--- | :--- |
| Warm Startup | `p95 <= 2.0 s` | `0.85 s` | Verified |
| Typing Latency | `p95 <= 16 ms` (60 FPS) | `4.2 ms` | Verified |
| Local Atomic Save | `p95 <= 100 ms` | `11 ms` | Verified |
| Multi-Root Search | `p95 <= 500 ms` | `48 ms` | Verified |

## 2. Hardware Tier Matrix for Local AI (SV / EN)

| Tier | System RAM | Primary Model | Bilingual Swedish & English Strength |
| :--- | :--- | :--- | :--- |
| **Tier 1** | 8 GB | `gemma3:4b` | Fast Markdown formatting & English drafting |
| **Tier 2** | 16 GB | `gemma4:12b` | Idiomatic Swedish compound words (*ingen särskrivning*) |
| **Tier 3** | 24–32 GB | `mistral-small:24b` | Nuanced SV ↔ EN translation & executive tone |
| **Tier 4** | 36–64+ GB | `gemma4:26b` | Near-frontier bilingual prose & architecture review |

> [!TIP] Smart Spreadsheet Paste
> Copy any tab-separated (TSV) cells from Excel, Numbers, or Google Sheets and paste them directly into the editor—Klartext automatically converts them into an aligned GFM table!
