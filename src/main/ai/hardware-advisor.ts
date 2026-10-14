import os from 'os'
import type { HardwareModelRecommendation, HardwareTierAdvice } from '../../shared/types'

const EMBEDDING_MODELS: HardwareModelRecommendation[] = [
  {
    tag: 'bge-m3',
    label: 'BGE-M3 (Multilingual SV+EN Embeddings)',
    downloadSize: '~1.2 GB',
    isTopPick: true,
    suitabilitySvEn:
      'Recommended for bilingual Swedish + English Workspace Q&A. Supports 100+ languages natively.'
  },
  {
    tag: 'nomic-embed-text',
    label: 'Nomic Embed Text (English Default)',
    downloadSize: '~274 MB',
    suitabilitySvEn: 'Fast, lightweight local embedding model primarily suited for English notes.'
  }
]

export function calculateHardwareTierAdvice(overrideRamBytes?: number): HardwareTierAdvice {
  const totalBytes = overrideRamBytes ?? os.totalmem()
  const detectedRamGb = Math.round(totalBytes / (1024 * 1024 * 1024))
  const cpus = os.cpus()
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'Generic CPU'
  const cpuArch = os.arch()
  const platform = os.platform()

  if (detectedRamGb < 14) {
    return {
      detectedRamGb,
      cpuArch,
      cpuModel,
      platform,
      tierId: 1,
      tierName: 'Tier 1: Entry / Ultrabook (Minimum)',
      summary:
        'Minimum viable local AI setup (~8 GB RAM). Fast token generation for English drafting, Markdown table/list formatting, and basic Swedish proofreading.',
      recommendedModels: [
        {
          tag: 'gemma3:4b',
          label: 'Gemma 3 4B (or gemma4:e4b)',
          downloadSize: '~3.3 GB',
          isTopPick: true,
          suitabilitySvEn:
            'Fastest compact model with strong multilingual tokenizer for basic Swedish and English.'
        },
        {
          tag: 'qwen3:4b',
          label: 'Qwen 3 4B',
          downloadSize: '~2.6 GB',
          suitabilitySvEn:
            'Strong Markdown formatting and code block generation with low RAM footprint.'
        }
      ],
      embeddingModels: EMBEDDING_MODELS
    }
  }

  if (detectedRamGb < 24) {
    return {
      detectedRamGb,
      cpuArch,
      cpuModel,
      platform,
      tierId: 2,
      tierName: 'Tier 2: Standard / Balanced (Recommended Minimum for High-Quality Swedish)',
      summary:
        'Sweet spot for 16 GB systems. Gemma 12B and Qwen 8B feature superior multilingual tokenizers that handle idiomatic Swedish compound words (undviker särskrivning) and English with high accuracy.',
      recommendedModels: [
        {
          tag: 'gemma4:12b',
          label: 'Gemma 4 12B (or gemma3:12b) [Top Pick]',
          downloadSize: '~7.6 GB',
          isTopPick: true,
          suitabilitySvEn:
            'Top pick for 16 GB RAM. Natural Swedish & English prose, accurate grammar, and clean Markdown.'
        },
        {
          tag: 'qwen3:8b',
          label: 'Qwen 3 8B (or qwen2.5:7b)',
          downloadSize: '~5.2 GB',
          suitabilitySvEn:
            'Fast bilingual assistant excelling at GFM tables, Mermaid diagrams, and structured lists.'
        },
        {
          tag: 'llama3.1:8b',
          label: 'Llama 3.1 8B (English Focus)',
          downloadSize: '~4.9 GB',
          suitabilitySvEn:
            'Great for English technical writing; less natural in Swedish than Gemma 12B.'
        }
      ],
      embeddingModels: EMBEDDING_MODELS
    }
  }

  if (detectedRamGb < 36) {
    return {
      detectedRamGb,
      cpuArch,
      cpuModel,
      platform,
      tierId: 3,
      tierName: 'Tier 3: Pro / Creator (24–32 GB RAM)',
      summary:
        'Professional bilingual writing & complex formatting. Deep European language coverage for nuanced Swedish ↔ English translation, tone shifting, and strict Mermaid/Markdown syntax adherence.',
      recommendedModels: [
        {
          tag: 'qwen3:14b',
          label: 'Qwen 3 14B',
          downloadSize: '~9.2 GB',
          isTopPick: true,
          suitabilitySvEn:
            'Excellent bilingual reasoning, complex table formatting, and Mermaid diagram generation.'
        },
        {
          tag: 'mistral-small:24b',
          label: 'Mistral Small 24B (Q4_K_M)',
          downloadSize: '~14.3 GB',
          suitabilitySvEn:
            'Strong European & Nordic language fluency; ideal for formal Swedish and English.'
        },
        {
          tag: 'gpt-oss:20b',
          label: 'GPT-OSS 20B (MXFP4)',
          downloadSize: '~12.0 GB',
          suitabilitySvEn: 'High-accuracy technical specification drafting and code block generation.'
        }
      ],
      embeddingModels: EMBEDDING_MODELS
    }
  }

  return {
    detectedRamGb,
    cpuArch,
    cpuModel,
    platform,
    tierId: 4,
    tierName: 'Tier 4: Workstation / Enthusiast (36–64+ GB RAM)',
    summary:
      'Near-frontier local quality. Exceptional Swedish and English prose quality with high-speed MoE or dense 26B–70B models.',
    recommendedModels: [
      {
        tag: 'gemma4:26b',
        label: 'Gemma 4 26B (or gemma3:27b)',
        downloadSize: '~17.5 GB',
        isTopPick: true,
        suitabilitySvEn:
          'Exceptional Swedish & English stylistic nuance, compound word precision, and translation.'
      },
      {
        tag: 'qwen3:30b-a3b',
        label: 'Qwen 3 30B-A3B (MoE — Blazing Fast)',
        downloadSize: '~18.5 GB',
        suitabilitySvEn:
          'Mixture-of-Experts with 3B active parameters: streams at extreme speed with top-tier accuracy.'
      },
      {
        tag: 'llama3.3:70b',
        label: 'Llama 3.3 70B (48 GB+ RAM)',
        downloadSize: '~42.5 GB',
        suitabilitySvEn: 'Workstation-grade long-document synthesis and technical architecture review.'
      }
    ],
    embeddingModels: EMBEDDING_MODELS
  }
}
