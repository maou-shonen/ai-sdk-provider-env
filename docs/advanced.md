# Advanced Usage

## Preset Auto-Detect

`presetAutoDetect` is enabled by default. When the config set name exactly matches a [built-in preset](../README.md#built-in-presets) name, the preset is applied automatically — no `_PRESET` env var needed. Only an API key is required:

```bash
OPENROUTER_API_KEY=sk-or-xxx
```

```ts
const provider = envProvider()

// openrouter preset auto-detected from config set name
const model = provider.languageModel('openrouter/some-model')
```

Explicit `_PRESET` and `_BASE_URL` env vars always take precedence over auto-detect. To disable:

```ts
envProvider({ presetAutoDetect: false })
```

## Native Routing

Some multi-model gateways (like `opencode-zen`) expose multiple AI provider protocols under one base URL. The `nativeRouting` feature auto-detects the model family from the model ID prefix and selects the corresponding native AI SDK.

### How It Works

When `nativeRouting` is enabled for a preset or config set:

| Model prefix | Routes to |
|---|---|
| `claude-*` | `@ai-sdk/anthropic` |
| `gemini-*` | `@ai-sdk/google` |
| `gpt-*` | `@ai-sdk/openai` |
| Other | Default `compatible` mode |

### Using with opencode-zen

The `opencode-zen` preset has `nativeRouting` enabled by default:

```bash
OPENCODE_ZEN_API_KEY=zen-xxx
```

```ts
// Routes to @ai-sdk/anthropic automatically
provider.languageModel('opencode-zen/claude-sonnet-4-20250514')

// Routes to @ai-sdk/google automatically
provider.languageModel('opencode-zen/gemini-3-flash')
```

### Disable Native Routing

To disable for a specific config set:

```bash
OPENCODE_ZEN_NATIVE_ROUTING=false
```

Or in code:

```ts
const provider = envProvider({
  configs: {
    mygateway: {
      baseURL: 'https://my-gateway.com/v1',
      apiKey: process.env.MYGATEWAY_API_KEY!,
      nativeRouting: false,
    },
  },
})
```

### Known Limitations

- Only `claude-*`, `gemini-*`, and `gpt-*` prefixes are matched.
- `o1-*`, `o3-*`, `chatgpt-*` are NOT auto-routed. Use `{PREFIX}_COMPATIBLE=openai` for these.
- `nativeRouting` as an object (per-route overrides) is not supported in this version.

## Provider Fallback

When `compatible: 'openai'` is used and `@ai-sdk/openai` is not installed, the provider falls back to `@ai-sdk/openai-compatible` automatically (when resolvable at runtime). For single-file builds, see [Bundler Usage](./bundler.md).

Anthropic and Google have no fallback — their SDKs must be installed. For full features like speech, transcription, and provider-specific tools, install the first-party SDK.

## Code-Based Configs

Skip env vars entirely and pass config directly. This takes the highest precedence:

```ts
const provider = envProvider({
  configs: {
    openai: {
      baseURL: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY!,
      compatible: 'openai',
    },
    claude: {
      baseURL: 'https://api.anthropic.com',
      apiKey: process.env.ANTHROPIC_API_KEY!,
      compatible: 'anthropic',
    },
    deepseek: {
      preset: 'deepseek',
      apiKey: process.env.DEEPSEEK_API_KEY!,
    },
  },
})

const model = provider.languageModel('openai/gpt-4o')
```

### Provider-specific options

Use `providerOptions` to pass extra options directly to the underlying SDK factory. This is useful for SDK-specific features that `ai-sdk-provider-env` doesn't expose as first-class fields:

```ts
const provider = envProvider({
  configs: {
    zai: {
      preset: 'zai',
      apiKey: process.env.ZAI_API_KEY!,
      providerOptions: { supportsStructuredOutputs: true },
    },
  },
})
```

## Custom Separator

If single underscores conflict with your naming scheme, use double underscores or any other shell-safe string:

```ts
const provider = envProvider({ separator: '__' })

// Now reads: OPENAI__BASE_URL, OPENAI__API_KEY, OPENAI__PRESET, OPENAI__COMPATIBLE
```

The separator must only contain ASCII letters, digits, or underscores (`[A-Za-z0-9_]+`). Characters like `-` or spaces are rejected since they produce env var names that are invalid in POSIX shells.

## Config Set Naming

Config set names (the part before `/` in the model ID) must match `[A-Za-z_][A-Za-z0-9_-]*` when resolved via env vars. Hyphens are normalized to underscores:

```ts
// Both read the same env vars: MY_API_API_KEY, MY_API_BASE_URL, etc.
provider.languageModel('my-api/model')
provider.languageModel('my_api/model')
```

Names that don't meet this requirement (Unicode, dots, digits at start, etc.) are rejected with an actionable error. Use [`configs`](#code-based-configs) for arbitrary names — it bypasses all naming restrictions:

```ts
const provider = envProvider({
  configs: {
    'my.special" provider': {
      baseURL: 'https://api.example.com/v1',
      apiKey: 'key',
    },
  },
})
```

## Custom Fetch

Pass a custom fetch implementation to all providers. Useful for proxies, logging, or test mocks:

```ts
const provider = envProvider({ defaults: { fetch: myCustomFetch } })
```

## Headers

### Default headers

Set HTTP headers that apply to all providers. Per-config-set headers override defaults with the same key:

```ts
const provider = envProvider({
  defaults: {
    headers: { 'X-App-Name': 'my-app', 'X-Request-Source': 'server' },
  },
})
```

### Per-config-set headers via env vars

Set custom HTTP headers using the `_HEADERS` env var (JSON format):

```bash
OPENAI_HEADERS={"X-Custom":"value","X-Request-Source":"my-app"}
```

Config-set headers take precedence over `defaults.headers` for the same key.

## Using with `createProviderRegistry`

`envProvider()` implements `ProviderV3`, so it works directly with `createProviderRegistry`:

```ts
import { createProviderRegistry, generateText } from 'ai'
import { envProvider } from 'ai-sdk-provider-env'

const registry = createProviderRegistry({
  env: envProvider(),
})

const model = registry.languageModel('env:openai/gpt-4o')
const embedder = registry.embeddingModel('env:openai/text-embedding-3-small')
const imageModel = registry.imageModel('env:openai/dall-e-3')
```

The model ID format inside the registry is `{registryKey}:{configSet}/{modelId}`. With the setup above, `env:openai/gpt-4o` means config set `openai`, model `gpt-4o`.

You can also mount multiple providers side by side:

```ts
import { createOpenAI } from '@ai-sdk/openai'

const registry = createProviderRegistry({
  env: envProvider(),
  openai: createOpenAI({ apiKey: process.env.OPENAI_API_KEY }),
})
```
