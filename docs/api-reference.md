# API Reference

## `envProvider(options?)`

Returns a `ProviderV3` instance.

```ts
import { envProvider } from 'ai-sdk-provider-env'

const provider = envProvider(options)
```

### Options (`EnvProviderOptions`)

| Option | Type | Default | Description |
|---|---|---|---|
| `separator` | `string` | `'_'` | Separator between the prefix and the variable name. Must match `[A-Za-z0-9_]+` (shell-safe). |
| `configs` | `Record<string, ConfigSetEntry>` | `undefined` | Explicit config sets (takes precedence over env vars) |
| `defaults` | `EnvProviderDefaults` | `undefined` | Global defaults applied to all providers (can be overridden per config set) |
| `presetAutoDetect` | `boolean` | `true` | Auto-apply a built-in preset when the config set name matches. Set to `false` to require explicit `_PRESET` configuration. |
| `factories` | `EnvProviderFactories` | `undefined` | User-provided factory functions for [bundler-safe usage](./bundler.md). |

### `EnvProviderDefaults`

| Option | Type | Default | Description |
|---|---|---|---|
| `fetch` | `typeof globalThis.fetch` | `undefined` | Custom fetch implementation passed to all created providers |
| `headers` | `Record<string, string>` | `undefined` | Default HTTP headers for all providers (overridden by config-set headers) |

### `ConfigSetEntry`

```ts
interface ConfigSetEntry {
  apiKey: string
  preset?: string
  baseURL?: string
  compatible?: 'openai' | 'anthropic' | 'gemini' | 'openai-compatible' // inherits from preset, or 'openai-compatible'
  headers?: Record<string, string>
  nativeRouting?: boolean // auto-route by model prefix to native SDK (claude-* → anthropic, gemini-* → google, gpt-* → openai)
}
```

### `PresetConfig`

Built-in presets expose the same fields as `ConfigSetEntry` (minus `apiKey`). The `nativeRouting` field is available on presets:

```ts
interface PresetConfig {
  baseURL: string
  compatible?: 'openai' | 'anthropic' | 'gemini' | 'openai-compatible'
  nativeRouting?: boolean
}
```

The `opencode-zen` preset has `nativeRouting: true` by default. Override it with `{PREFIX}_NATIVE_ROUTING=false`.

### Model ID format

```text
{configSet}/{modelId}
```

The first `/` splits the config set name from the model ID. Everything after is passed as-is to the underlying provider.

**Config set naming rules** (env-var resolution path):
- Must match `[A-Za-z_][A-Za-z0-9_-]*` — ASCII letters, digits, underscores, hyphens
- Hyphens (`-`) are normalized to underscores (`_`) for env var lookup: `my-api` → `MY_API_*`
- `my-api` and `my_api` resolve to the same env vars
- Names outside these rules require the `configs` option

Examples: `openai/gpt-4o`, `my-api/some-model`, `anthropic/claude-sonnet-4-20250514`.
