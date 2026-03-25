/**
 * A structural provider interface compatible with both `ProviderV3` and `ProviderV4`
 * from `@ai-sdk/provider`.
 *
 * This type is intentionally broad so that factory functions from both
 * `@ai-sdk/openai@3.x` (returns `ProviderV3`) and `@ai-sdk/openai@4.x`
 * (returns `ProviderV4`) are accepted without requiring the consumer to
 * install a specific major version of `@ai-sdk/provider`.
 *
 * @remarks
 * We do NOT import `ProviderV4` directly because it only exists in
 * `@ai-sdk/provider@>=4.0.0`. Referencing it in our `.d.ts` output would
 * break users on `@ai-sdk/provider@3.x`.
 */
export interface ProviderV3Compatible {
  readonly specificationVersion: string
  languageModel: (modelId: string) => unknown
  embeddingModel: (modelId: string) => unknown
  imageModel: (modelId: string) => unknown
  textEmbeddingModel?: ((modelId: string) => unknown) | undefined
  transcriptionModel?: ((modelId: string) => unknown) | undefined
  speechModel?: ((modelId: string) => unknown) | undefined
  rerankingModel?: ((modelId: string) => unknown) | undefined
}

/**
 * Configuration for a single config set.
 *
 * Can be resolved automatically from environment variables, or specified explicitly in code.
 * When `preset` is set, `baseURL` and `compatible` become optional and fall back to the preset defaults.
 */
export interface ConfigSetEntry {
  /** API key */
  apiKey: string
  /**
   * Built-in preset name, used to resolve default values for `baseURL` and `compatible`.
   *
   * When set, `baseURL` and `compatible` become optional and can be used to override the preset defaults.
   */
  preset?: string
  /** API base URL (optional when `preset` is set) */
  baseURL?: string
  /**
   * Compatibility mode
   *
   * - `'openai'` — uses `createOpenAI`
   * - `'anthropic'` — uses `createAnthropic`
   * - `'gemini'` — uses `createGoogleGenerativeAI`
   * - `'openai-compatible'` — uses `createOpenAICompatible` with the config set name as the provider name (default)
   */
  compatible?: 'openai' | 'anthropic' | 'gemini' | 'openai-compatible'
  /**
   * Custom HTTP headers appended to API requests.
   *
   * When set via environment variables, use JSON format:
   * `{PREFIX}_HEADERS={"X-Custom-Header":"value"}`
   */
  headers?: Record<string, string>
  /**
   * When enabled, auto-detects model family from model ID prefix and routes to the
   * native provider SDK (`claude-*`→anthropic, `gemini-*`→gemini, `gpt-*`→openai).
   * Non-matching models fall back to this config set's default `compatible` mode.
   *
   * Can also be set via `{PREFIX}_NATIVE_ROUTING=true|false` env var.
   */
  nativeRouting?: boolean
}

/**
 * Preset provider configuration.
 *
 * Similar to `ConfigSetEntry`, but omits `apiKey` (provided via environment variables).
 */
export interface PresetConfig {
  /** API base URL */
  baseURL: string
  /**
   * Compatibility mode
   *
   * - `'openai'` — uses `createOpenAI`
   * - `'anthropic'` — uses `createAnthropic`
   * - `'gemini'` — uses `createGoogleGenerativeAI`
   * - `'openai-compatible'` — uses `createOpenAICompatible` with the config set name as the provider name (default)
   */
  compatible?: 'openai' | 'anthropic' | 'gemini' | 'openai-compatible'
  /**
   * When enabled, auto-detects model family from model ID prefix and routes to the
   * native provider SDK (`claude-*`→anthropic, `gemini-*`→gemini, `gpt-*`→openai).
   * Non-matching models fall back to the preset's default `compatible` mode.
   *
   * Control per-config-set via `{PREFIX}_NATIVE_ROUTING=true|false` env var.
   */
  nativeRouting?: boolean
}

/**
 * Global defaults for `envProvider()`.
 *
 * These values are applied to all providers but can be overridden per config set.
 */
export interface EnvProviderDefaults {
  /**
   * Default `fetch` implementation passed to all created providers.
   *
   * Useful for logging, proxying requests, or injecting custom behavior.
   *
   * @example
   * envProvider({ defaults: { fetch: myCustomFetch } })
   */
  fetch?: typeof globalThis.fetch

  /**
   * Default HTTP headers appended to all provider API requests.
   *
   * Can be overridden by per-config-set `headers` (from env vars or code configs).
   * Merge strategy: config-set headers take precedence for the same key.
   *
   * @example
   * envProvider({
   *   defaults: {
   *     headers: { 'X-App-Name': 'my-app', 'X-Request-Source': 'server' },
   *   },
   * })
   */
  headers?: Record<string, string>
}

/**
 * Options passed to user-provided factory functions.
 *
 * This is the library's own type — it does NOT reference any provider SDK types,
 * so your `.d.ts` output won't force consumers to install `@ai-sdk/*` packages.
 */
export interface EnvProviderFactoryOptions {
  /** API base URL */
  baseURL: string
  /** API key */
  apiKey: string
  /** Custom HTTP headers */
  headers?: Record<string, string>
  /** Custom fetch implementation */
  fetch?: typeof globalThis.fetch
}

/**
 * Options passed to the `openai-compatible` factory function.
 *
 * Extends {@link EnvProviderFactoryOptions} with a `name` field
 * that identifies the config set (used as the provider name).
 */
export interface EnvProviderNamedFactoryOptions extends EnvProviderFactoryOptions {
  /** Config set name, used as the provider name */
  name: string
}

/**
 * User-provided factory functions for bundler-safe provider creation.
 *
 * When using a bundler (e.g. `bun build --compile`), dynamic `require()` calls
 * cannot resolve provider SDKs. Providing factories via static imports
 * allows the bundler to trace and include only the providers you actually use.
 *
 * @example
 * ```ts
 * import { createOpenAI } from '@ai-sdk/openai'
 * import { createAnthropic } from '@ai-sdk/anthropic'
 * import { envProvider } from 'ai-sdk-provider-env'
 *
 * const provider = envProvider({
 *   factories: {
 *     openai: createOpenAI,
 *     anthropic: createAnthropic,
 *   },
 * })
 * ```
 */
export interface EnvProviderFactories {
  /**
   * Factory for `compatible: 'openai'` — e.g. pass `createOpenAI` from `@ai-sdk/openai`.
   * If not provided, falls back to `@ai-sdk/openai-compatible` via dynamic `require()` (works in environments with `node_modules`).
   *
   * Accepts factories returning either `ProviderV3` (`@ai-sdk/openai@3.x`) or
   * `ProviderV4` (`@ai-sdk/openai@4.x`).
   */
  openai?: (options: EnvProviderFactoryOptions) => ProviderV3Compatible
  /**
   * Factory for `compatible: 'anthropic'` — e.g. pass `createAnthropic` from `@ai-sdk/anthropic`.
   *
   * Accepts factories returning either `ProviderV3` or `ProviderV4`.
   */
  anthropic?: (options: EnvProviderFactoryOptions) => ProviderV3Compatible
  /**
   * Factory for `compatible: 'gemini'` — e.g. pass `createGoogleGenerativeAI` from `@ai-sdk/google`.
   *
   * Accepts factories returning either `ProviderV3` or `ProviderV4`.
   */
  gemini?: (options: EnvProviderFactoryOptions) => ProviderV3Compatible
  /**
   * Factory for `compatible: 'openai-compatible'` — e.g. pass `createOpenAICompatible` from `@ai-sdk/openai-compatible`.
   * If not provided, falls back to `@ai-sdk/openai-compatible` via dynamic `require()` (works in environments with `node_modules`).
   *
   * Accepts factories returning either `ProviderV3` or `ProviderV4`.
   */
  openaiCompatible?: (options: EnvProviderNamedFactoryOptions) => ProviderV3Compatible
}

/**
 * Options for `envProvider()`.
 */
export interface EnvProviderOptions {
  /**
   * Separator between the env var prefix and the variable name.
   *
   * Must only contain ASCII letters, digits, or underscores (`[A-Za-z0-9_]+`)
   * to produce POSIX shell-safe env var names. An error is thrown if the
   * separator contains other characters (e.g. `-`, spaces).
   *
   * @default '_'
   * @example
   * // Default separator '_'
   * // ZHIPU_BASE_URL, ZHIPU_API_KEY, ZHIPU_COMPATIBLE
   *
   * @example
   * // Custom separator '__'
   * // ZHIPU__BASE_URL, ZHIPU__API_KEY, ZHIPU__COMPATIBLE
   * envProvider({ separator: '__' })
   */
  separator?: string

  /**
   * Explicit config set configurations defined in code. Takes precedence over env vars.
   *
   * @example
   * envProvider({
   *   configs: {
   *     zhipu: {
   *       baseURL: 'https://open.bigmodel.cn/api/paas/v4',
   *       apiKey: 'my-key',
   *       compatible: 'openai',
   *     },
   *     deepseek: {
   *       preset: 'deepseek',
   *       apiKey: 'my-key',
   *     },
   *   },
   * })
   */
  configs?: Record<string, ConfigSetEntry>

  /**
   * Global defaults applied to all providers.
   *
   * Allows setting a default `fetch` implementation and `headers`,
   * which can be overridden by per-config-set settings.
   *
   * @example
   * envProvider({
   *   defaults: {
   *     fetch: myCustomFetch,
   *     headers: { 'X-App-Name': 'my-app' },
   *   },
   * })
   */
  defaults?: EnvProviderDefaults

  /**
   * Automatically use a built-in preset when the config set name matches a preset name.
   *
   * When enabled (default), if a config set name matches a built-in preset name (e.g., `openai`, `anthropic`, `deepseek`),
   * that preset is automatically applied without requiring the `{PREFIX}_PRESET` environment variable.
   * Set to `false` to disable this behavior and require explicit preset configuration.
   *
   * @example
   * // With presetAutoDetect enabled (default):
   * // OPENAI_API_KEY=sk-xxx
   * // → automatically uses the 'openai' preset
   *
   * @example
   * // With presetAutoDetect disabled:
   * // OPENAI_API_KEY=sk-xxx
   * // OPENAI_PRESET=openai  (required)
   * envProvider({ presetAutoDetect: false })
   */
  presetAutoDetect?: boolean

  /**
   * User-provided factory functions for bundler-safe provider creation.
   *
   * When set, the library uses these factories instead of dynamic `require()` calls.
   * Only provide factories for the compatibility modes you actually use —
   * a clear error is thrown if a missing factory is needed at runtime.
   *
   * @example
   * ```ts
   * import { createOpenAI } from '@ai-sdk/openai'
   * import { envProvider } from 'ai-sdk-provider-env'
   *
   * const provider = envProvider({
   *   factories: { openai: createOpenAI },
   * })
   * ```
   */
  factories?: EnvProviderFactories
}
