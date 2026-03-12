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
| `separator` | `string` | `'_'` | Separator between the prefix and the variable name |
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
}
```

### Model ID format

```text
{configSet}/{modelId}
```

The first `/` splits the config set name from the model ID. Everything after is passed as-is to the underlying provider.

Examples: `openai/gpt-4o`, `anthropic/claude-sonnet-4-20250514`, `myapi/some-model`.
