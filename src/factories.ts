import type { ProviderV3Compatible } from './types'

export interface ProviderOpts {
  baseURL: string
  apiKey: string
  headers?: Record<string, string>
  fetch?: typeof globalThis.fetch
}

/**
 * Check if an error is a "module not found" error for a specific package.
 *
 * Handles Node.js (error.code), Bun, and Bun compiled binaries
 * which may throw non-standard error objects.
 */
export function isModuleNotFoundError(error: unknown, packageName: string): boolean {
  if (typeof error !== 'object' || error === null)
    return false

  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  const code = 'code' in error ? (error as Record<string, unknown>).code : undefined

  // Only match the module name in the "Cannot find module/package 'X'" part,
  // not in the require stack that follows. This prevents false positives when
  // a sub-dependency fails but the parent package appears in the stack trace.
  const isResolutionError = code === 'MODULE_NOT_FOUND'
    || code === 'ERR_MODULE_NOT_FOUND'
    || message.startsWith('Cannot find module')
    || message.startsWith('Cannot find package')

  if (!isResolutionError)
    return false

  // Extract the quoted module name from "Cannot find module 'X'" or "Cannot find package 'X'"
  // Handles both single and double quote styles across runtimes.
  const quoted = message.match(/Cannot find (?:module|package) ['"]([^'"]+)['"]/)
  if (quoted)
    return quoted[1] === packageName || quoted[1].startsWith(`${packageName}/`)

  // Fallback for non-standard message formats (e.g. some Bun versions):
  // check if the package name appears before any "Require stack:" section,
  // with boundary checking to avoid false positives (e.g. @ai-sdk/openai matching @ai-sdk/openai-compatible).
  const requireStackIndex = message.indexOf('\nRequire stack:')
  const relevantPart = requireStackIndex !== -1 ? message.slice(0, requireStackIndex) : message
  const boundaryPattern = new RegExp(`(?:^|[\\s'"/@])${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[\\s'"/@]|$)`)
  return boundaryPattern.test(relevantPart)
}

/**
 * Create an OpenAI provider.
 *
 * Dynamically requires `@ai-sdk/openai`, so it only needs to be installed when actually used.
 * When not installed, errors propagate to allow fallback to OpenAI-compatible provider.
 */
export function createOpenAIProvider(opts: ProviderOpts): ProviderV3Compatible {
  // eslint-disable-next-line ts/no-require-imports
  const { createOpenAI } = require('@ai-sdk/openai')
  return createOpenAI(opts)
}

/**
 * Create an Anthropic provider.
 *
 * Dynamically requires `@ai-sdk/anthropic`, so it only needs to be installed when actually used.
 * No fallback is available — Anthropic does not support the OpenAI-compatible protocol.
 */
export function createAnthropicProvider(opts: ProviderOpts): ProviderV3Compatible {
  try {
    // eslint-disable-next-line ts/no-require-imports
    const { createAnthropic } = require('@ai-sdk/anthropic')
    return createAnthropic(opts)
  }
  catch (error) {
    if (isModuleNotFoundError(error, '@ai-sdk/anthropic')) {
      throw new Error(
        '[ai-sdk-provider-env] Anthropic provider requires @ai-sdk/anthropic. '
        + 'Run: npm install @ai-sdk/anthropic',
      )
    }
    throw error
  }
}

/**
 * Create a Google Generative AI (Gemini) provider.
 *
 * Dynamically requires `@ai-sdk/google`, so it only needs to be installed when actually used.
 * No fallback is available — Google does not support the OpenAI-compatible protocol.
 */
export function createGeminiProvider(opts: ProviderOpts): ProviderV3Compatible {
  try {
    // eslint-disable-next-line ts/no-require-imports
    const { createGoogleGenerativeAI } = require('@ai-sdk/google')
    return createGoogleGenerativeAI(opts)
  }
  catch (error) {
    if (isModuleNotFoundError(error, '@ai-sdk/google')) {
      throw new Error(
        '[ai-sdk-provider-env] Google provider requires @ai-sdk/google. '
        + 'Run: npm install @ai-sdk/google',
      )
    }
    throw error
  }
}

/**
 * Create an OpenAI Compatible provider.
 *
 * `@ai-sdk/openai-compatible` is a regular dependency and always available.
 */
export function createOpenAICompatibleProvider(opts: ProviderOpts & { name: string }): ProviderV3Compatible {
  // eslint-disable-next-line ts/no-require-imports
  const { createOpenAICompatible } = require('@ai-sdk/openai-compatible')
  return createOpenAICompatible(opts)
}
