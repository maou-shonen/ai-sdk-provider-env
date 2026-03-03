import type { ProviderV3 } from '@ai-sdk/provider'
import type { ProviderOpts } from './factories'
import type { EnvProviderOptions } from './types'
import process from 'node:process'
import { NoSuchModelError } from '@ai-sdk/provider'
import { createAnthropicProvider, createGeminiProvider, createOpenAICompatibleProvider, createOpenAIProvider } from './factories'
import { builtinPresets } from './presets'

/**
 * Interface for provider factory functions, used for dependency injection.
 *
 * In production, `defaultFactories` delegates to the real SDK implementations.
 * In tests, fake factories can be injected to avoid module mocking.
 */
export interface ProviderFactories {
  createOpenAI: (opts: ProviderOpts) => ProviderV3
  createAnthropic: (opts: ProviderOpts) => ProviderV3
  createGemini: (opts: ProviderOpts) => ProviderV3
  createOpenAICompatible: (opts: ProviderOpts & { name: string }) => ProviderV3
}

/**
 * Default factories that delegate to the real implementations in `factories.ts`.
 */
const defaultFactories: ProviderFactories = {
  createOpenAI: createOpenAIProvider,
  createAnthropic: createAnthropicProvider,
  createGemini: createGeminiProvider,
  createOpenAICompatible: createOpenAICompatibleProvider,
}

/**
 * Internally resolved configuration with all required fields determined.
 */
interface ResolvedConfig {
  baseURL: string
  apiKey: string
  compatible: string
  headers?: Record<string, string>
}

/**
 * Testable core implementation that accepts injected provider factories.
 *
 * In tests, call this function directly with fake factories
 * to avoid module mocking entirely.
 */
export function createEnvProvider(
  factories: ProviderFactories,
  options: EnvProviderOptions = {},
): ProviderV3 {
  const separator = options.separator ?? '_'
  const defaultFetch = options.defaults?.fetch
  const defaultHeaders = options.defaults?.headers

  // Cache created providers to avoid redundant initialization
  const cache = new Map<string, ProviderV3>()

  /**
   * Resolve baseURL and compatible from a preset name.
   */
  function resolvePreset(presetName: string): { baseURL: string, compatible: string } {
    const preset = builtinPresets[presetName]
    if (!preset) {
      const available = Object.keys(builtinPresets).join(', ')
      throw new Error(
        `[ai-sdk-provider-env] Unknown preset "${presetName}". Available presets: ${available}`,
      )
    }
    return {
      baseURL: preset.baseURL,
      compatible: preset.compatible ?? 'openai-compatible',
    }
  }

  /**
   * Resolve config set configuration from explicit configs, presets, or environment variables.
   */
  function resolveConfig(configSet: string): ResolvedConfig {
    // Explicit configs take precedence over env vars
    if (options.configs?.[configSet]) {
      const config = options.configs[configSet]

      // Code-based configs also support presets
      if (config.preset) {
        const preset = resolvePreset(config.preset)
        return {
          baseURL: config.baseURL ?? preset.baseURL,
          apiKey: config.apiKey,
          compatible: config.compatible ?? preset.compatible,
          ...(config.headers && { headers: config.headers }),
        }
      }

      if (!config.baseURL) {
        throw new Error(
          `[ai-sdk-provider-env] Missing baseURL in config for "${configSet}"`
          + ` (or set preset to use a built-in preset)`,
        )
      }

      return {
        baseURL: config.baseURL,
        apiKey: config.apiKey,
        compatible: config.compatible ?? 'openai-compatible',
        ...(config.headers && { headers: config.headers }),
      }
    }

    const prefix = configSet.toUpperCase()
    const env = (key: string): string | undefined => process.env[`${prefix}${separator}${key}`]

    const apiKey = env('API_KEY')
    if (!apiKey) {
      throw new Error(
        `[ai-sdk-provider-env] Missing env var ${prefix}${separator}API_KEY`,
      )
    }

    // Parse headers from env var (JSON format)
    const headersRaw = env('HEADERS')
    let headers: Record<string, string> | undefined
    if (headersRaw) {
      try {
        headers = JSON.parse(headersRaw)
      }
      catch {
        throw new Error(
          `[ai-sdk-provider-env] Invalid JSON in ${prefix}${separator}HEADERS: ${headersRaw}`,
        )
      }
    }

    // Check for preset
    const presetName = env('PRESET')
    if (presetName) {
      const preset = resolvePreset(presetName)
      return {
        baseURL: env('BASE_URL') ?? preset.baseURL,
        apiKey,
        compatible: env('COMPATIBLE') ?? preset.compatible,
        ...(headers && { headers }),
      }
    }

    // Without a preset, try BASE_URL first
    const baseURL = env('BASE_URL')
    if (baseURL) {
      return {
        baseURL,
        apiKey,
        compatible: env('COMPATIBLE') ?? 'openai-compatible',
        ...(headers && { headers }),
      }
    }

    // Auto-detect: if configSet name matches a built-in preset, use it automatically
    if (options.presetAutoDetect !== false) {
      const autoPreset = builtinPresets[configSet.toLowerCase()]
      if (autoPreset) {
        return {
          baseURL: autoPreset.baseURL,
          apiKey,
          compatible: env('COMPATIBLE') ?? autoPreset.compatible ?? 'openai-compatible',
          ...(headers && { headers }),
        }
      }
    }

    // Error: neither BASE_URL nor a matching preset found
    const available = Object.keys(builtinPresets).join(', ')
    const presetHint = builtinPresets[configSet.toLowerCase()]
      ? ` (Note: "${configSet}" matches a built-in preset, but presetAutoDetect is disabled.)`
      : ''
    throw new Error(
      `[ai-sdk-provider-env] Missing env var ${prefix}${separator}BASE_URL`
      + ` (or set ${prefix}${separator}PRESET to use a preset.`
      + ` Available presets: ${available})${presetHint}`,
    )
  }

  /**
   * Create the underlying provider based on the compatibility mode.
   */
  function createUnderlying(configSet: string, config: ResolvedConfig): ProviderV3 {
    const { baseURL, apiKey, compatible, headers } = config

    // Merge headers: defaults.headers as base, config-set headers override matching keys
    const mergedHeaders = (defaultHeaders || headers)
      ? { ...defaultHeaders, ...headers }
      : undefined

    const baseOpts = {
      baseURL,
      apiKey,
      ...(mergedHeaders && { headers: mergedHeaders }),
      ...(defaultFetch && { fetch: defaultFetch }),
    }

    switch (compatible) {
      case 'openai':
        return factories.createOpenAI(baseOpts)
      case 'anthropic':
        return factories.createAnthropic(baseOpts)
      case 'gemini':
        return factories.createGemini(baseOpts)
      case 'openai-compatible':
        return factories.createOpenAICompatible({ name: configSet, ...baseOpts })
      default:
        throw new Error(
          `[ai-sdk-provider-env] Unknown compatible mode "${compatible}".`
          + ` Supported values: "openai", "anthropic", "gemini", "openai-compatible".`
          + ` Set COMPATIBLE=openai-compatible (or omit it) to use the OpenAI-compatible provider.`,
        )
    }
  }

  /**
   * Get or create a cached provider for the given config set.
   */
  function getProvider(configSet: string): ProviderV3 {
    const key = configSet.toUpperCase()
    const cached = cache.get(key)
    if (cached)
      return cached

    const config = resolveConfig(configSet)
    const provider = createUnderlying(configSet, config)
    cache.set(key, provider)
    return provider
  }

  /**
   * Parse a model ID. The first `/` separates the config set name from the actual model ID.
   */
  function parseModelId(modelId: string): { configSet: string, model: string } {
    const slashIndex = modelId.indexOf('/')
    if (slashIndex === -1) {
      throw new Error(
        `[ai-sdk-provider-env] Invalid model ID "${modelId}". `
        + `Expected format: "{configSet}/{modelId}", e.g. "zhipu/glm-4"`,
      )
    }
    return {
      configSet: modelId.slice(0, slashIndex),
      model: modelId.slice(slashIndex + 1),
    }
  }

  return {
    specificationVersion: 'v3' as const,

    languageModel(modelId: string) {
      const { configSet, model } = parseModelId(modelId)
      return getProvider(configSet).languageModel(model)
    },

    embeddingModel(modelId: string) {
      const { configSet, model } = parseModelId(modelId)
      return getProvider(configSet).embeddingModel(model)
    },

    imageModel(modelId: string) {
      const { configSet, model } = parseModelId(modelId)
      return getProvider(configSet).imageModel(model)
    },

    textEmbeddingModel(modelId: string) {
      const { configSet, model } = parseModelId(modelId)
      const provider = getProvider(configSet)
      if (!provider.textEmbeddingModel) {
        throw new NoSuchModelError({ modelId, modelType: 'embeddingModel' })
      }
      return provider.textEmbeddingModel(model)
    },

    transcriptionModel(modelId: string) {
      const { configSet, model } = parseModelId(modelId)
      const provider = getProvider(configSet)
      if (!provider.transcriptionModel) {
        throw new NoSuchModelError({ modelId, modelType: 'transcriptionModel' })
      }
      return provider.transcriptionModel(model)
    },

    speechModel(modelId: string) {
      const { configSet, model } = parseModelId(modelId)
      const provider = getProvider(configSet)
      if (!provider.speechModel) {
        throw new NoSuchModelError({ modelId, modelType: 'speechModel' })
      }
      return provider.speechModel(model)
    },

    rerankingModel(modelId: string) {
      const { configSet, model } = parseModelId(modelId)
      const provider = getProvider(configSet)
      if (!provider.rerankingModel) {
        throw new NoSuchModelError({ modelId, modelType: 'rerankingModel' })
      }
      return provider.rerankingModel(model)
    },
  }
}

/**
 * Create a dynamic, environment-variable-driven AI SDK provider.
 *
 * Automatically resolves provider configurations from env var naming conventions,
 * with built-in preset support for quick setup.
 *
 * Env var convention (using config set `ZHIPU` with default separator `_` as example):
 * - `ZHIPU_PRESET`     — use a built-in preset (BASE_URL and COMPATIBLE become optional)
 * - `ZHIPU_BASE_URL`   — API base URL
 * - `ZHIPU_API_KEY`    — API key (required)
 * - `ZHIPU_COMPATIBLE` — compatibility mode (defaults to `'openai-compatible'`)
 * - `ZHIPU_HEADERS`    — custom HTTP headers (JSON format)
 *
 * @example
 * ```ts
 * import { createProviderRegistry } from 'ai'
 * import { envProvider } from 'ai-sdk-provider-env'
 *
 * const registry = createProviderRegistry({
 *   env: envProvider(),
 * })
 *
 * // Use a preset (only API_KEY is required)
 * // DEEPSEEK_PRESET=deepseek
 * // DEEPSEEK_API_KEY=sk-xxx
 * const model = registry.languageModel('env:deepseek/deepseek-chat')
 *
 * // Specify all parameters manually
 * // MYAPI_BASE_URL=https://api.example.com/v1
 * // MYAPI_API_KEY=xxx
 * const model2 = registry.languageModel('env:myapi/some-model')
 * ```
 */
export function envProvider(options: EnvProviderOptions = {}): ProviderV3 {
  return createEnvProvider(defaultFactories, options)
}
