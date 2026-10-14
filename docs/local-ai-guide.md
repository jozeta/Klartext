# Local AI Setup & Hardware Guide (English & Svenska)

Klartext connects to local inference servers running on `localhost` (`127.0.0.1`) from the Electron Main Process so your documents never leave your machine.

## 1. Quick Setup

1. **Install Ollama (Recommended):**
   - Download from `https://ollama.com` (macOS / Windows) or run `curl -fsSL https://ollama.com/install.sh | sh` on Linux.
   - Default endpoint: `http://127.0.0.1:11434`.
2. **Alternative — LM Studio:**
   - Open LM Studio -> Local Server tab -> Start Server on port `1234` (`http://127.0.0.1:1234/v1`).
3. **Pull a Vetted English & Swedish Model:**
   - Open Klartext's Right AI Panel (`AI` button in top bar) to view your detected RAM tier and copy the recommended `ollama pull <model>` command.
4. **Verify Connection:**
   - Click **Test** in the Local AI Panel to discover installed models and verify latency.

## 2. Hardware Tiers & Recommended Bilingual (SV/EN) Models

| Tier | System RAM | Recommended Models | Why for English & Swedish |
| :--- | :--- | :--- | :--- |
| **Tier 1 (Entry)** | 8 GB | `gemma3:4b`, `qwen3:4b` | Fast token generation for English drafting, tables, and basic Swedish proofreading. |
| **Tier 2 (Balanced)** | 16 GB | **`gemma4:12b`** (Top Pick), `qwen3:8b` | Superior multilingual tokenizers that avoid Swedish compound-word splitting (*särskrivning*). |
| **Tier 3 (Pro)** | 24–32 GB | `qwen3:14b`, `mistral-small:24b` | Deep European & Nordic language fluency for nuanced SV ↔ EN translation and strict Markdown formatting. |
| **Tier 4 (Workstation)** | 36–64+ GB | `gemma4:26b`, `qwen3:30b-a3b` | Near-frontier bilingual prose quality and blazing-fast Mixture-of-Experts streaming. |
| **Embeddings (RAG)** | Any Tier | `bge-m3`, `nomic-embed-text` | `bge-m3` natively supports Swedish and English cross-root workspace Q&A. |
