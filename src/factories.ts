import type { ProviderV3 } from '@ai-sdk/provider'

export interface ProviderOpts {
  baseURL: string
  apiKey: string
  headers?: Record<string, string>
  fetch?: typeof globalThis.fetch
}

/**
 * Create an OpenAI provider.
 *
 * Dynamically requires `@ai-sdk/openai`, so it only needs to be installed when actually used.
 */
export function createOpenAIProvider(opts: ProviderOpts): ProviderV3 {
  try {
    // eslint-disable-next-line ts/no-require-imports
    const { createOpenAI } = require('@ai-sdk/openai')
    return createOpenAI(opts)
  }
  catch {
    throw new Error(
      '[ai-sdk-provider-env] openai compatibility mode requires @ai-sdk/openai. '
      + 'Run: npm install @ai-sdk/openai',
    )
  }
}

/**
 * Create an Anthropic provider.
 *
 * Dynamically requires `@ai-sdk/anthropic`, so it only needs to be installed when actually used.
 */
export function createAnthropicProvider(opts: ProviderOpts): ProviderV3 {
  try {
    // eslint-disable-next-line ts/no-require-imports
    const { createAnthropic } = require('@ai-sdk/anthropic')
    return createAnthropic(opts)
  }
  catch {
    throw new Error(
      '[ai-sdk-provider-env] anthropic compatibility mode requires @ai-sdk/anthropic. '
      + 'Run: npm install @ai-sdk/anthropic',
    )
  }
}

/**
 * Create an OpenAI Compatible provider.
 *
 * Dynamically requires `@ai-sdk/openai-compatible`, so it only needs to be installed when actually used.
 */
export function createOpenAICompatibleProvider(opts: ProviderOpts & { name: string }): ProviderV3 {
  try {
    // eslint-disable-next-line ts/no-require-imports
    const { createOpenAICompatible } = require('@ai-sdk/openai-compatible')
    return createOpenAICompatible(opts)
  }
  catch {
    throw new Error(
      '[ai-sdk-provider-env] openai-compatible mode requires @ai-sdk/openai-compatible. '
      + 'Run: npm install @ai-sdk/openai-compatible',
    )
  }
}
