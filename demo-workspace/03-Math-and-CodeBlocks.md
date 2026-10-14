---
title: KaTeX Mathematics & Polyglot Code Blocks
topic: Algorithms & Physics
---

# 03. KaTeX Mathematics & Code Blocks

 switch to **Split Mode** (`Cmd/Ctrl + 3`) to see side-by-side synchronized rendering of KaTeX equations and syntax-highlighted code blocks! Connected to [[01-Typography-and-Callouts]] and [[05-Bilingual-AI-Playground-SV-EN]].

## 1. Inline & Block KaTeX Equations

Inline mathematical expressions render smoothly, such as Euler's identity $e^{i\pi} + 1 = 0$ and mass-energy equivalence $E = mc^2$.

### Gaussian Normal Distribution & Transformer Attention

$$
f(x) = \frac{1}{\sigma \sqrt{2\pi}} \exp\left( -\frac{1}{2}\left(\frac{x - \mu}{\sigma}\right)^2 \right)
$$

$$
\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V
$$

---

## 2. Fenced Code Blocks

```typescript
// Multi-Root Path Confinement Check
export function isStrictSubpath(parentRealPath: string, targetRealPath: string): boolean {
  const rel = path.relative(parentRealPath, targetRealPath)
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))
}
```

```python
def calculate_bm25_score(term_freq: int, doc_len: int, avg_doc_len: float, k1: float = 1.5, b: float = 0.75) -> float:
    norm = term_freq + k1 * (1.0 - b + b * (doc_len / avg_doc_len))
    return (term_freq * (k1 + 1.0)) / norm
```
