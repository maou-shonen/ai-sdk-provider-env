import type { PresetConfig } from './types'

/**
 * Built-in preset configurations for common providers.
 *
 * When using a preset, only `{PREFIX}__PRESET` and `{PREFIX}__API_KEY`
 * are required; `BASE_URL` and `COMPATIBLE` are provided by the preset.
 */
export const builtinPresets: Record<string, PresetConfig> = {
  // OpenAI
  openai: {
    baseURL: 'https://api.openai.com/v1',
    compatible: 'openai',
  },

  // Anthropic
  anthropic: {
    baseURL: 'https://api.anthropic.com',
    compatible: 'anthropic',
  },

  // DeepSeek
  deepseek: {
    baseURL: 'https://api.deepseek.com',
    compatible: 'openai',
  },

  // Zhipu AI (GLM series)
  zhipu: {
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    compatible: 'openai',
  },

  // Groq
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    compatible: 'openai',
  },

  // Together AI
  together: {
    baseURL: 'https://api.together.xyz/v1',
    compatible: 'openai',
  },

  // Fireworks AI
  fireworks: {
    baseURL: 'https://api.fireworks.ai/inference/v1',
    compatible: 'openai',
  },

  // Mistral AI
  mistral: {
    baseURL: 'https://api.mistral.ai/v1',
    compatible: 'openai',
  },

  // Moonshot AI
  moonshot: {
    baseURL: 'https://api.moonshot.cn/v1',
    compatible: 'openai',
  },

  // Perplexity
  perplexity: {
    baseURL: 'https://api.perplexity.ai',
    compatible: 'openai',
  },

  // OpenRouter
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    compatible: 'openai',
  },

  // SiliconFlow
  siliconflow: {
    baseURL: 'https://api.siliconflow.cn/v1',
    compatible: 'openai',
  },
}
