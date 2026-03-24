import type { ProviderV3 } from '@ai-sdk/provider'
import type { EnvProviderFactories, EnvProviderFactoryOptions, EnvProviderNamedFactoryOptions, EnvProviderOptions, ProviderV3Compatible } from './types'
import process from 'node:process'
import { NoSuchModelError } from '@ai-sdk/provider'
import { createAnthropicProvider, createGeminiProvider, createOpenAICompatibleProvider, createOpenAIProvider, isModuleNotFoundError } from './factories'
import { builtinPresets } from './presets'

/**
 * Thrown when a provider is not available (factory not provided by user).
 * Used internally to trigger fallback to OpenAI-compatible provider.
 */
class ProviderNotAvailableError extends Error {
  constructor(provider: string) {
    super(`Provider "${provider}" is not available`)
    this.name = 'ProviderNotAvailableError'
  }
}

/**
 * Interface for provider factory functions, used for dependency injection.
 *
 * In production, `defaultFactories` delegates to the real SDK implementations.
 * In tests, fake factories can be injected to avoid module mocking.
 *
 * Return types use `ProviderV3Compatible` so that both `ProviderV3`
 * (from `@ai-sdk/provider@3.x`) and `ProviderV4` (`@ai-sdk/provider@4.x`)
 * are accepted.
 */
export interface ProviderFactories {
  createOpenAI: (opts: EnvProviderFactoryOptions) => ProviderV3Compatible
  createAnthropic: (opts: EnvProviderFactoryOptions) => ProviderV3Compatible
  createGemini: (opts: EnvProviderFactoryOptions) => ProviderV3Compatible
  createOpenAICompatible: (opts: EnvProviderNamedFactoryOptions) => ProviderV3Compatible
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
 * Detect the native compatible mode for a model based on its ID prefix.
 *
 * Used by nativeRouting to auto-route model families to their native provider SDKs.
 * Only `claude-*`, `gemini-*`, and `gpt-*` prefixes are matched.
 * Known limitation: `o1-*`, `o3-*`, `chatgpt-*` are NOT matched (use explicit compatible mode).
 *
 * @returns The detected compatible mode, or `undefined` if no match.
 */
export function detectNativeCompatible(model: string): 'openai' | 'anthropic' | 'gemini' | undefined {
  if (model.startsWith('claude-'))
    return 'anthropic'
  if (model.startsWith('gemini-'))
    return 'gemini'
  if (model.startsWith('gpt-'))
    return 'openai'
  return undefined
}

/**
 * Internally resolved configuration with all required fields determined.
 */
interface ResolvedConfig {
  baseURL: string
  apiKey: string
  compatible: string
  headers?: Record<string, string>
  nativeRouting?: boolean
}

/**
 * Testable core implementation that accepts injected provider factories.
 *
 * In tests, call this function directly with fake factories
 * to avoid module mocking entirely.
 */
export function createEnvProvider(
  factories: ProviderFactories,
  options: Omit<EnvProviderOptions, 'factories'> = {},
): ProviderV3 {
  const separator = options.separator ?? '_'
  const defaultFetch = options.defaults?.fetch
  const defaultHeaders = options.defaults?.headers

  // Cache created providers to avoid redundant initialization
  // Stored as ProviderV3 via safe cast from ProviderV3Compatible,
  // since V3 and V4 provider interfaces are structurally identical.
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
          nativeRouting: config.nativeRouting,
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
        nativeRouting: config.nativeRouting,
        ...(config.headers && { headers: config.headers }),
      }
    }

    // --- All checks below apply only to the env-var resolution path ---
    // The configs option (above) bypasses these and accepts arbitrary names/separators.

    // Validate separator produces shell-safe env var names (deferred to first env-var use)
    if (!/^\w+$/.test(separator)) {
      throw new Error(
        `[ai-sdk-provider-env] Invalid separator "${separator}". `
        + `Separator must only contain ASCII letters, digits, or underscores to produce shell-safe env var names.`,
      )
    }

    // Validate config set name (ASCII shell-safe names only)
    if (!/^[A-Z_][\w-]*$/i.test(configSet)) {
      throw new Error(
        `[ai-sdk-provider-env] Invalid config set name "${configSet}". `
        + `Names must start with a letter or underscore, followed by letters, digits, underscores, or hyphens. `
        + `For arbitrary names, use the configs option instead.`,
      )
    }

    // Normalize hyphens to underscores for POSIX shell-safe env var names.
    // e.g. "my-api" → "MY_API", so env vars are MY_API_API_KEY, MY_API_BASE_URL, etc.
    const prefix = configSet.replace(/-/g, '_').toUpperCase()
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
  function createUnderlying(configSet: string, config: ResolvedConfig): ProviderV3Compatible {
    const { baseURL, apiKey, compatible, headers, nativeRouting } = config

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
        try {
          return factories.createOpenAI(baseOpts)
        }
        catch (error) {
          // Fallback to OpenAI-compatible when:
          // - @ai-sdk/openai is not installed (module not found)
          // - User-provided factories don't include openai (ProviderNotAvailableError)
          if (isModuleNotFoundError(error, '@ai-sdk/openai') || error instanceof ProviderNotAvailableError) {
            try {
              return factories.createOpenAICompatible({ name: configSet, ...baseOpts })
            }
            catch (fallbackError) {
              // Only swallow module-not-found errors from the fallback itself
              if (isModuleNotFoundError(fallbackError, '@ai-sdk/openai-compatible') || fallbackError instanceof ProviderNotAvailableError) {
                throw new Error(
                  '[ai-sdk-provider-env] Could not load @ai-sdk/openai or its openai-compatible fallback. '
                  + 'Install @ai-sdk/openai for full OpenAI features, or if using a bundler, '
                  + 'provide factories: { openai: createOpenAI }',
                )
              }
              // Non-module-not-found errors from openai-compatible (e.g. config issues) should propagate
              throw fallbackError
            }
          }
          throw error
        }
      case 'anthropic':
        try {
          return factories.createAnthropic(baseOpts)
        }
        catch (error) {
          if (isModuleNotFoundError(error, '@ai-sdk/anthropic')) {
            const nativeHint = nativeRouting
              ? ` (nativeRouting auto-detected this model as Anthropic. Disable with ${configSet.replace(/-/g, '_').toUpperCase()}_NATIVE_ROUTING=false to use openai-compatible instead.)`
              : ''
            throw new Error(
              `[ai-sdk-provider-env] Anthropic provider requires @ai-sdk/anthropic. `
              + `Run: npm install @ai-sdk/anthropic${nativeHint}`,
            )
          }
          throw error
        }
      case 'gemini':
        try {
          return factories.createGemini(baseOpts)
        }
        catch (error) {
          if (isModuleNotFoundError(error, '@ai-sdk/google')) {
            const nativeHint = nativeRouting
              ? ` (nativeRouting auto-detected this model as Gemini. Disable with ${configSet.replace(/-/g, '_').toUpperCase()}_NATIVE_ROUTING=false to use openai-compatible instead.)`
              : ''
            throw new Error(
              `[ai-sdk-provider-env] Google provider requires @ai-sdk/google. `
              + `Run: npm install @ai-sdk/google${nativeHint}`,
            )
          }
          throw error
        }
      case 'openai-compatible':
        try {
          return factories.createOpenAICompatible({ name: configSet, ...baseOpts })
        }
        catch (error) {
          if (isModuleNotFoundError(error, '@ai-sdk/openai-compatible')) {
            throw new Error(
              '[ai-sdk-provider-env] Could not load @ai-sdk/openai-compatible. '
              + 'If using a bundler, provide factories: { openaiCompatible: createOpenAICompatible }',
            )
          }
          throw error
        }
      default:
        throw new Error(
          `[ai-sdk-provider-env] Unknown compatible mode "${compatible}".`
          + ` Supported values: "openai", "anthropic", "gemini", "openai-compatible".`
          + ` Set COMPATIBLE=openai-compatible (or omit it) to use the OpenAI-compatible provider.`,
        )
    }
  }

  /**
   * Compute a cache key for the given config set.
   *
   * Explicit configs use the raw (uppercased) name, so `foo-bar` and `foo_bar`
   * remain distinct when both are defined in `configs`.
   * Env-var-backed config sets normalize hyphens to underscores, so aliases
   * like `my-api` and `my_api` share one cached provider.
   */
  function getCacheKey(configSet: string, config: ResolvedConfig, effectiveCompatible: string): string {
    if (options.configs?.[configSet]) {
      if (config.nativeRouting) {
        return `config:${configSet.toUpperCase()}:${effectiveCompatible}`
      }
      return `config:${configSet.toUpperCase()}`
    }
    if (config.nativeRouting) {
      return `env:${configSet.replace(/-/g, '_').toUpperCase()}:${effectiveCompatible}`
    }
    return `env:${configSet.replace(/-/g, '_').toUpperCase()}`
  }

  /**
   * Get or create a cached provider for the given config set.
   *
   * Returns `ProviderV3` via a safe cast from `ProviderV3Compatible`.
   * This is safe because `ProviderV3` and `ProviderV4` have identical
   * method signatures — only `specificationVersion` and model type brands differ.
   */
  function getProvider(configSet: string, model?: string): ProviderV3 {
    const config = resolveConfig(configSet)

    const effectiveCompatible = (config.nativeRouting && model)
      ? (detectNativeCompatible(model) ?? config.compatible)
      : config.compatible

    const key = getCacheKey(configSet, config, effectiveCompatible)
    const cached = cache.get(key)
    if (cached)
      return cached

    const configForProvider = effectiveCompatible !== config.compatible
      ? { ...config, compatible: effectiveCompatible }
      : config

    // Safe cast: V3 and V4 providers are structurally identical.
    // The underlying provider may be ProviderV3 or ProviderV4 depending
    // on which SDK version the user has installed.
    const provider = createUnderlying(configSet, configForProvider) as unknown as ProviderV3
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
      return getProvider(configSet, model).languageModel(model)
    },

    embeddingModel(modelId: string) {
      const { configSet, model } = parseModelId(modelId)
      return getProvider(configSet, model).embeddingModel(model)
    },

    imageModel(modelId: string) {
      const { configSet, model } = parseModelId(modelId)
      return getProvider(configSet, model).imageModel(model)
    },

    textEmbeddingModel(modelId: string) {
      const { configSet, model } = parseModelId(modelId)
      const provider = getProvider(configSet, model)
      // Prefer textEmbeddingModel if the underlying provider has it (V3).
      if (provider.textEmbeddingModel) {
        return provider.textEmbeddingModel(model)
      }
      // V4 providers removed textEmbeddingModel — fall back to embeddingModel
      // which exists in both V3 and V4 interfaces.
      if (provider.embeddingModel) {
        return provider.embeddingModel(model)
      }
      throw new NoSuchModelError({ modelId, modelType: 'embeddingModel' })
    },

    transcriptionModel(modelId: string) {
      const { configSet, model } = parseModelId(modelId)
      const provider = getProvider(configSet, model)
      if (!provider.transcriptionModel) {
        throw new NoSuchModelError({ modelId, modelType: 'transcriptionModel' })
      }
      return provider.transcriptionModel(model)
    },

    speechModel(modelId: string) {
      const { configSet, model } = parseModelId(modelId)
      const provider = getProvider(configSet, model)
      if (!provider.speechModel) {
        throw new NoSuchModelError({ modelId, modelType: 'speechModel' })
      }
      return provider.speechModel(model)
    },

    rerankingModel(modelId: string) {
      const { configSet, model } = parseModelId(modelId)
      const provider = getProvider(configSet, model)
      if (!provider.rerankingModel) {
        throw new NoSuchModelError({ modelId, modelType: 'rerankingModel' })
      }
      return provider.rerankingModel(model)
    },
  }
}

/**
 * Build internal `ProviderFactories` from user-provided `EnvProviderFactories`.
 *
 * Uses lazy-strict semantics: each factory slot is only evaluated when actually called.
 * If the user provided a factory for a given compatible mode, it is used;
 * otherwise, a clear error is thrown (no silent fallback to dynamic `require()`).
 */
function buildUserFactories(userFactories: EnvProviderFactories): ProviderFactories {
  function missingFactory(key: string, fnName: string, pkg: string): never {
    throw new Error(
      `[ai-sdk-provider-env] No factory provided for "${key}". `
      + `When using the factories option, provide a factory for each compatibility mode you use. `
      + `Add: import { ${fnName} } from '${pkg}' and set factories: { ${key}: ${fnName} }`,
    )
  }

  return {
    createOpenAI: (opts) => {
      if (userFactories.openai)
        return userFactories.openai(opts)
      // Signal fallback — createUnderlying will catch this and use openai-compatible
      throw new ProviderNotAvailableError('openai')
    },
    createAnthropic: opts =>
      userFactories.anthropic
        ? userFactories.anthropic(opts)
        : missingFactory('anthropic', 'createAnthropic', '@ai-sdk/anthropic'),
    createGemini: opts =>
      userFactories.gemini
        ? userFactories.gemini(opts)
        : missingFactory('gemini', 'createGoogleGenerativeAI', '@ai-sdk/google'),
    createOpenAICompatible: opts =>
      userFactories.openaiCompatible
        ? userFactories.openaiCompatible(opts)
        : createOpenAICompatibleProvider(opts),
  }
}

/**
 * Create a dynamic, environment-variable-driven AI SDK provider.
 *
 * Automatically resolves provider configurations from env var naming conventions,
 * with built-in preset support for quick setup.
 *
 * Config set naming rules:
 * - Names must match `[A-Za-z_][A-Za-z0-9_-]*` (ASCII letters, digits, underscores, hyphens)
 * - Hyphens are normalized to underscores for env var lookup:
 *   `my-api/model` → reads `MY_API_API_KEY`, `MY_API_BASE_URL`, etc.
 * - For arbitrary names, use the `configs` option instead
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
 *
 * @example Bundler-safe usage with explicit factories
 * ```ts
 * import { createOpenAI } from '@ai-sdk/openai'
 * import { envProvider } from 'ai-sdk-provider-env'
 *
 * const provider = envProvider({
 *   factories: { openai: createOpenAI },
 * })
 * ```
 */
export function envProvider(options: EnvProviderOptions = {}): ProviderV3 {
  const factories = options.factories
    ? buildUserFactories(options.factories)
    : defaultFactories
  return createEnvProvider(factories, options)
}
