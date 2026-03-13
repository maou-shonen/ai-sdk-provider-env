import type { PresetConfig } from './types'

/**
 * Built-in preset configurations for common providers.
 *
 * When using a preset, only `{PREFIX}__PRESET` and `{PREFIX}__API_KEY`
 * are required; `BASE_URL` and `COMPATIBLE` are provided by the preset.
 */
export const builtinPresets: Record<string, PresetConfig> = {
  // OpenAI
  'openai': {
    baseURL: 'https://api.openai.com/v1',
    compatible: 'openai',
  },

  // Anthropic
  'anthropic': {
    baseURL: 'https://api.anthropic.com',
    compatible: 'anthropic',
  },

  // Google AI Studio (Gemini)
  'google': {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    compatible: 'gemini',
  },

  // DeepSeek
  'deepseek': {
    baseURL: 'https://api.deepseek.com',
    compatible: 'openai-compatible',
  },

  // Zhipu AI (GLM series)
  'zhipu': {
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    compatible: 'openai-compatible',
  },

  // Groq
  'groq': {
    baseURL: 'https://api.groq.com/openai/v1',
    compatible: 'openai-compatible',
  },

  // Together AI
  'together': {
    baseURL: 'https://api.together.xyz/v1',
    compatible: 'openai-compatible',
  },

  // Fireworks AI
  'fireworks': {
    baseURL: 'https://api.fireworks.ai/inference/v1',
    compatible: 'openai-compatible',
  },

  // Mistral AI
  'mistral': {
    baseURL: 'https://api.mistral.ai/v1',
    compatible: 'openai-compatible',
  },

  // Moonshot AI (international)
  'moonshot': {
    baseURL: 'https://api.moonshot.ai/v1',
    compatible: 'openai-compatible',
  },

  // Moonshot AI (China mainland)
  'moonshot-china': {
    baseURL: 'https://api.moonshot.cn/v1',
    compatible: 'openai-compatible',
  },

  // Perplexity
  'perplexity': {
    baseURL: 'https://api.perplexity.ai',
    compatible: 'openai-compatible',
  },

  // OpenRouter
  'openrouter': {
    baseURL: 'https://openrouter.ai/api/v1',
    compatible: 'openai-compatible',
  },

  // SiliconFlow (international)
  'siliconflow': {
    baseURL: 'https://api.siliconflow.com/v1',
    compatible: 'openai-compatible',
  },

  // SiliconFlow (China mainland)
  'siliconflow-china': {
    baseURL: 'https://api.siliconflow.cn/v1',
    compatible: 'openai-compatible',
  },

  // xAI (Grok series)
  'xai': {
    baseURL: 'https://api.x.ai/v1',
    compatible: 'openai-compatible',
  },

  // Zhipu AI International (Z.AI — global endpoint for GLM series)
  'zai': {
    baseURL: 'https://api.z.ai/api/paas/v4',
    compatible: 'openai-compatible',
  },

  // OpenCode Zen (curated multi-model AI gateway)
  'opencode-zen': {
    baseURL: 'https://opencode.ai/zen/v1',
    compatible: 'openai-compatible',
  },

  // OpenCode Go (low-cost subscription for open coding models)
  'opencode-go': {
    baseURL: 'https://opencode.ai/zen/go/v1',
    compatible: 'openai-compatible',
  },
}
