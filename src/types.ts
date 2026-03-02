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
   * - `'openai-compatible'` — uses `createOpenAICompatible` with the config set name as the provider name (default)
   */
  compatible?: 'openai' | 'anthropic' | 'openai-compatible'
  /**
   * Custom HTTP headers appended to API requests.
   *
   * When set via environment variables, use JSON format:
   * `{PREFIX}_HEADERS={"X-Custom-Header":"value"}`
   */
  headers?: Record<string, string>
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
   * - `'openai-compatible'` — uses `createOpenAICompatible` with the config set name as the provider name (default)
   */
  compatible?: 'openai' | 'anthropic' | 'openai-compatible'
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
 * Options for `envProvider()`.
 */
export interface EnvProviderOptions {
  /**
   * Separator between the env var prefix and the variable name.
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
}
