> [中文](./README_zh.md)

# ai-sdk-provider-env

A dynamic, environment-variable-driven provider for [Vercel AI SDK](https://sdk.vercel.ai/). Resolves AI provider configuration from env var conventions at runtime, so you can switch models without touching code.

[![npm version](https://img.shields.io/npm/v/ai-sdk-provider-env)](https://www.npmjs.com/package/ai-sdk-provider-env)
[![license](https://img.shields.io/npm/l/ai-sdk-provider-env)](./LICENSE)

## Motivation

Using multiple AI providers with Vercel AI SDK means importing each SDK, configuring API keys and base URLs, and wiring everything together — per provider, per project. Switching providers requires code changes.

`ai-sdk-provider-env` eliminates this boilerplate. Define provider configurations through environment variables, resolve them at runtime. Add a new provider by setting env vars, switch models by changing a string — no code changes needed.

## Features

- Resolve provider config (base URL, API key, compatibility mode) from environment variables automatically
- Built-in presets for popular providers, so you only need to set an API key
- Supports OpenAI, Anthropic, Google Gemini, and any OpenAI-compatible API (OpenAI mode falls back to openai-compatible at runtime when `node_modules` are available)
- Implements `ProviderV3`, plugs directly into `createProviderRegistry`
- Provider instances are cached, no redundant initialization
- Fully customizable: custom fetch, env-based headers, custom separator, code-based configs

## Installation

```bash
pnpm add ai-sdk-provider-env
```

Install provider SDKs as needed:

```bash
pnpm add @ai-sdk/openai            # for OpenAI
pnpm add @ai-sdk/anthropic         # for Anthropic
pnpm add @ai-sdk/google            # for Google AI Studio (Gemini)
```

`@ai-sdk/openai-compatible` is included as a dependency and used automatically when needed. For single-file / `bun build --compile` builds, provide an explicit `openaiCompatible` factory (see [Bundler Usage](./docs/bundler.md)).

## Quick Start

```ts
import { createProviderRegistry, generateText } from 'ai'
import { envProvider } from 'ai-sdk-provider-env'

const registry = createProviderRegistry({
  env: envProvider(),
})

// Use a preset: only API_KEY is required
// OPENAI_API_KEY=sk-xxx  (OPENAI_PRESET=openai is optional — auto-detected)
const model = registry.languageModel('env:openai/gpt-4o')

const { text } = await generateText({ model, prompt: 'Hello!' })
```

Any env var prefix is a config set. Two endpoints? Two prefixes, zero code changes:

```bash
# .env
FAST_BASE_URL=https://fast-api.example.com/v1
FAST_API_KEY=key-fast

SMART_BASE_URL=https://smart-api.example.com/v1
SMART_API_KEY=key-smart
```

```ts
const draft = await generateText({
  model: registry.languageModel('env:fast/llama-3-8b'),
  prompt: 'Write a story',
})

const review = await generateText({
  model: registry.languageModel('env:smart/gpt-4o'),
  prompt: `Review this: ${draft.text}`,
})
```

## Environment Variable Convention

The model ID format is `{configSet}/{modelId}`. The config set name maps to an env var prefix (uppercased).

With the default separator `_`, a config set reads these variables (`[MYAI]` = your config set name, uppercased):

| Variable | Required | Description |
|---|---|---|
| `[MYAI]_API_KEY` | Yes | API key |
| `[MYAI]_BASE_URL` | Yes (unless preset is set or auto-detected) | API base URL |
| `[MYAI]_PRESET` | No | Built-in preset name (e.g. `openai`) |
| `[MYAI]_COMPATIBLE` | No | Compatibility mode (default: `openai-compatible`) |
| `[MYAI]_HEADERS` | No | Custom HTTP headers (JSON format) |

When `PRESET` is set, `BASE_URL` and `COMPATIBLE` become optional and fall back to the preset's values.

**Compatibility modes:**

| Value | Behavior |
|---|---|
| `openai` | Uses `@ai-sdk/openai`. Falls back to `@ai-sdk/openai-compatible` if not installed |
| `anthropic` | Uses `@ai-sdk/anthropic` |
| `gemini` | Uses `@ai-sdk/google` |
| `openai-compatible` | Uses `@ai-sdk/openai-compatible` with the config set name as the provider name (default) |

## Provider Fallback

When `compatible: 'openai'` is used and `@ai-sdk/openai` is not installed, the provider falls back to `@ai-sdk/openai-compatible` when that package is resolvable at runtime (e.g. with `node_modules` available). For single-file / `bun build --compile` builds, provide an explicit `openaiCompatible` factory (see [Bundler Usage](./docs/bundler.md)).

Anthropic and Google have no fallback. Their SDKs must be installed to use their respective compatibility modes.

For full features like speech, transcription, and provider-specific tools, install the first-party SDK (`@ai-sdk/openai`, `@ai-sdk/anthropic`, or `@ai-sdk/google`).

## Built-in Presets

| Preset name | Base URL | Compatible |
|---|---|---|
| `openai` | `https://api.openai.com/v1` | `openai` |
| `anthropic` | `https://api.anthropic.com` | `anthropic` |
| `google` | `https://generativelanguage.googleapis.com/v1beta` | `gemini` |
| `deepseek` | `https://api.deepseek.com` | `openai-compatible` |
| `zhipu` | `https://open.bigmodel.cn/api/paas/v4` | `openai-compatible` |
| `groq` | `https://api.groq.com/openai/v1` | `openai-compatible` |
| `together` | `https://api.together.xyz/v1` | `openai-compatible` |
| `fireworks` | `https://api.fireworks.ai/inference/v1` | `openai-compatible` |
| `mistral` | `https://api.mistral.ai/v1` | `openai-compatible` |
| `moonshot` | `https://api.moonshot.cn/v1` | `openai-compatible` |
| `perplexity` | `https://api.perplexity.ai` | `openai-compatible` |
| `openrouter` | `https://openrouter.ai/api/v1` | `openai-compatible` |
| `siliconflow` | `https://api.siliconflow.cn/v1` | `openai-compatible` |

## Preset Auto-Detect

`presetAutoDetect` is enabled by default. When the config set name exactly matches a built-in preset name, the preset is applied automatically — no `_PRESET` env var needed. Only an API key is required:

```bash
# OPENROUTER_API_KEY is all you need
OPENROUTER_API_KEY=sk-or-xxx
```

```ts
const provider = envProvider()

// Works — openrouter preset auto-detected from config set name
const model = provider.languageModel('openrouter/some-model')
```

Explicit `_PRESET` and `_BASE_URL` env vars always take precedence over auto-detect. To disable this behavior:

```ts
envProvider({ presetAutoDetect: false })
```

## API Reference

### `envProvider(options?)`

Returns a `ProviderV3` instance.

```ts
import { envProvider } from 'ai-sdk-provider-env'

const provider = envProvider(options)
```

**Options** (`EnvProviderOptions`):

| Option | Type | Default | Description |
|---|---|---|---|
| `separator` | `string` | `'_'` | Separator between the prefix and the variable name |
| `configs` | `Record<string, ConfigSetEntry>` | `undefined` | Explicit config sets (takes precedence over env vars) |
| `defaults` | `EnvProviderDefaults` | `undefined` | Global defaults applied to all providers (can be overridden per config set) |
| `presetAutoDetect` | `boolean` | `true` | Auto-apply a built-in preset when the config set name matches. Set to `false` to require explicit `_PRESET` configuration. |
| `factories` | `EnvProviderFactories` | `undefined` | User-provided factory functions for [bundler-safe usage](#bundler-usage). |

**`EnvProviderDefaults`:**

| Option | Type | Default | Description |
|---|---|---|---|
| `fetch` | `typeof globalThis.fetch` | `undefined` | Custom fetch implementation passed to all created providers |
| `headers` | `Record<string, string>` | `undefined` | Default HTTP headers for all providers (overridden by config-set headers) |

**`ConfigSetEntry`:**

```ts
interface ConfigSetEntry {
  apiKey: string
  preset?: string
  baseURL?: string
  compatible?: 'openai' | 'anthropic' | 'gemini' | 'openai-compatible' // default: 'openai-compatible'
  headers?: Record<string, string>
}
```

**Model ID format:**

```
{configSet}/{modelId}
```

Examples: `openai/gpt-4o`, `anthropic/claude-sonnet-4-20250514`, `myapi/some-model`.

## Advanced Usage

### Custom separator

If single underscores conflict with your naming scheme, use double underscores or any other string:

```ts
const provider = envProvider({ separator: '__' })

// Now reads: OPENAI__BASE_URL, OPENAI__API_KEY, OPENAI__PRESET, OPENAI__COMPATIBLE
```

### Code-based configs

Skip env vars entirely and pass config directly. This takes the highest precedence:

```ts
const provider = envProvider({
  configs: {
    openai: {
      baseURL: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_KEY!,
      compatible: 'openai',
    },
    claude: {
      baseURL: 'https://api.anthropic.com',
      apiKey: process.env.ANTHROPIC_KEY!,
      compatible: 'anthropic',
    },
    deepseek: {
      preset: 'deepseek',
      apiKey: process.env.DEEPSEEK_KEY!,
    },
  },
})

const model = provider.languageModel('openai/gpt-4o')
```

### Custom fetch

Pass a custom fetch implementation to all providers. Useful for proxies, logging, or test mocks:

```ts
const provider = envProvider({ defaults: { fetch: myCustomFetch } })
```

### Default headers

Set HTTP headers that apply to all providers. Per-config-set headers (from env vars or code configs) override defaults with the same key:

```ts
const provider = envProvider({
  defaults: {
    headers: { 'X-App-Name': 'my-app', 'X-Request-Source': 'server' },
  },
})
```

### Custom headers via env vars

Set per-config-set HTTP headers using the `HEADERS` env var. The value must be valid JSON:

```bash
OPENAI_HEADERS={"X-Custom":"value","X-Request-Source":"my-app"}
```

These headers are merged into every request made by that config set's provider. When combined with `defaults.headers`, config-set headers take precedence for the same key.

### Using with `createProviderRegistry`

`envProvider()` implements `ProviderV3`, so it works directly with `createProviderRegistry`:

```ts
import { createProviderRegistry, generateText } from 'ai'
import { envProvider } from 'ai-sdk-provider-env'

const registry = createProviderRegistry({
  env: envProvider(),
})

// Language model
const model = registry.languageModel('env:openai/gpt-4o')

// Embedding model
const embedder = registry.embeddingModel('env:openai/text-embedding-3-small')

// Image model
const imageModel = registry.imageModel('env:openai/dall-e-3')

const { text } = await generateText({
  model,
  prompt: 'Hello!',
})
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

## Bundler Usage

Works out of the box without a bundler. If you bundle your app, two options:

**Option A** — mark packages as external (server-side with `node_modules`):

```bash
bun build --packages=external
```

**Option B** — provide explicit factories (single-file / `bun build --compile`):

```ts
import { createOpenAI } from '@ai-sdk/openai'
import { envProvider } from 'ai-sdk-provider-env'

const provider = envProvider({
  factories: { openai: createOpenAI },
})
```

For the full guide (factory key mapping, lazy-strict behavior, combining with other options), see **[Bundler Usage Guide](./docs/bundler.md)**.
