---
title: Syntax-Highlighted Code Blocks
author: Core Runtime Team
category: Engineering
tags:
  - code
  - syntax-highlighting
  - typescript
  - rust
---

# Syntax-Highlighted Code Blocks

Fenced code blocks render with compact line numbers, language badges, and semantic syntax highlighting across TypeScript, Python, Rust, SQL, and Shell scripts.

## TypeScript — Atomic Multi-Root Asset Service

```typescript
export interface SaveAssetRequest {
  rootId: string
  documentRelativePath: string
  fileName: string
  mimeType: string
}

export async function resolveScopedAssetPath(req: SaveAssetRequest): Promise<string> {
  const safeName = req.fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
  return `assets/images/${Date.now()}-${safeName}`
}
```

## Rust — Zero-Copy Line Indexer

```rust
pub struct LineSpan {
    pub line_number: usize,
    pub byte_offset: usize,
}

pub fn index_markdown_lines(buffer: &str) -> Vec<LineSpan> {
    buffer
        .lines()
        .enumerate()
        .map(|(idx, line)| LineSpan {
            line_number: idx + 1,
            byte_offset: line.len(),
        })
        .collect()
}
```

## Python — Local Embedding Pipeline

```python
from typing import List

def normalize_vector(weights: List[float]) -> List[float]:
    # Compute L2 norm for local bge-m3 embeddings
    norm = sum(w * w for w in weights) ** 0.5
    return [round(w / norm, 5) for w in weights] if norm > 0 else weights
```
