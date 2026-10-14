# Markdown Compatibility Matrix

| Construct | Syntax | Round-Trip Guarantee | Rendering Pipeline |
| :--- | :--- | :--- | :--- |
| **Headings** | `# H1` – `###### H6` | Byte-for-byte | `remark-parse` + CM6 Live Preview line decorations |
| **Emphasis & Strike** | `**bold**`, `*italic*`, `~~strike~~` | Byte-for-byte | `remark-gfm` + CM6 inline mark decorations |
| **GFM Tables** | Pipe tables with `:---` alignment | Preserved; optional alignment via `formatMarkdownTable` | `remark-gfm` + TSV/CSV smart clipboard converter |
| **Task Lists** | `- [ ]` / `- [x]` | Byte-for-byte | Interactive checkbox widget in CM6 Live Preview |
| **Math (KaTeX)** | `$inline$` and `$$block$$` | Byte-for-byte | `remark-math` + `rehype-katex` |
| **YAML Frontmatter** | `---\nkey: value\n---` | Lossless YAML serialization | `remark-frontmatter` + collapsible property editor |
| **Callouts** | `> [!NOTE]`, `> [!WARNING]`, etc. | Byte-for-byte | Preprocessor callout container + Nordic accent border |
| **WikiLinks** | `[[Page]]`, `[[Page\|Alias]]`, `[[Root:Page]]` | Byte-for-byte | Resolved within active root; cross-root badge warning |
| **Mermaid Diagrams** | ```` ```mermaid ```` code fences | Source fence is single source of truth | `MermaidDiagramWidget` (`securityLevel: 'strict'`) |
| **Excalidraw** | `![Title](assets/drawings/x.excalidraw.svg)` | Embedded JSON inside `<metadata>` of valid `.svg` | `serializeExcalidrawSvg` / `extractExcalidrawSceneFromSvgOrJson` |
