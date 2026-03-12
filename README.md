> [中文](./README_zh.md)

# ai-sdk-provider-env

Environment-variable-driven provider for [Vercel AI SDK](https://sdk.vercel.ai/). Switch AI providers and models without code changes.

[![npm version](https://img.shields.io/npm/v/ai-sdk-provider-env)](https://www.npmjs.com/package/ai-sdk-provider-env)
[![license](https://img.shields.io/npm/l/ai-sdk-provider-env)](./LICENSE)

## Quick Start

```bash
pnpm add ai-sdk-provider-env @ai-sdk/openai
```

```bash
# .env
OPENAI_API_KEY=sk-xxx
```

```ts
import { generateText } from 'ai'
import { envProvider } from 'ai-sdk-provider-env'

const provider = envProvider()

const { text } = await generateText({
  model: provider.languageModel('openai/gpt-4o'),
  prompt: 'Hello!',
})
```

The config set name `openai` auto-matches the built-in preset — only an API key is needed.

Any [valid](#environment-variables) env var prefix becomes a config set. Two endpoints, zero code changes:

```bash
# .env
FAST_BASE_URL=https://fast-api.example.com/v1
FAST_API_KEY=key-fast

SMART_BASE_URL=https://smart-api.example.com/v1
SMART_API_KEY=key-smart
```

```ts
provider.languageModel('fast/llama-3-8b')
provider.languageModel('smart/gpt-4o')
```

## Environment Variables

Model ID format: `{configSet}/{modelId}`. The config set maps to an uppercased env var prefix.

Config set names must match `[A-Za-z_][A-Za-z0-9_-]*` — ASCII letters, digits, underscores, and hyphens. **Hyphens are automatically normalized to underscores** for env var lookup:

```bash
# Config set "my-api" → reads MY_API_* env vars
MY_API_BASE_URL=https://api.example.com/v1
MY_API_API_KEY=sk-xxx
```

```ts
provider.languageModel('my-api/some-model')  // reads MY_API_* env vars
provider.languageModel('my_api/some-model')  // same env vars
```

> For config set names outside these rules (e.g. Unicode, dots), use the [`configs` option](./docs/advanced.md#code-based-configs) instead.

| Variable | Required | Description |
|---|---|---|
| `{PREFIX}_API_KEY` | Yes | API key |
| `{PREFIX}_BASE_URL` | Unless preset matches | API base URL |
| `{PREFIX}_PRESET` | No | Built-in preset name (e.g. `openai`) |
| `{PREFIX}_COMPATIBLE` | No | `openai` · `anthropic` · `gemini` · `openai-compatible` (default) |
| `{PREFIX}_HEADERS` | No | Custom HTTP headers (JSON) |

When `_PRESET` is set or [auto-detected](#built-in-presets), `_BASE_URL` and `_COMPATIBLE` fall back to preset defaults.

### Compatibility modes

| Value | SDK | Fallback |
|---|---|---|
| `openai` | `@ai-sdk/openai` | `@ai-sdk/openai-compatible` if not installed |
| `anthropic` | `@ai-sdk/anthropic` | None |
| `gemini` | `@ai-sdk/google` | None |
| `openai-compatible` | `@ai-sdk/openai-compatible` (default) | — |

Install provider SDKs as needed: `pnpm add @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google`

## Built-in Presets

When the config set name matches a preset, it auto-applies — only `_API_KEY` is needed:

```bash
DEEPSEEK_API_KEY=sk-xxx          # config set "deepseek" matches the preset
```

```ts
provider.languageModel('deepseek/deepseek-chat')   // just works
```

| Preset | Base URL | Compatible |
|---|---|---|
| `openai` | `https://api.openai.com/v1` | `openai` |
| `anthropic` | `https://api.anthropic.com` | `anthropic` |
| `google` | `https://generativelanguage.googleapis.com/v1beta` | `gemini` |
| `deepseek` | `https://api.deepseek.com` | `openai-compatible` |
| `groq` | `https://api.groq.com/openai/v1` | `openai-compatible` |
| `together` | `https://api.together.xyz/v1` | `openai-compatible` |
| `fireworks` | `https://api.fireworks.ai/inference/v1` | `openai-compatible` |
| `mistral` | `https://api.mistral.ai/v1` | `openai-compatible` |
| `moonshot` | `https://api.moonshot.cn/v1` | `openai-compatible` |
| `perplexity` | `https://api.perplexity.ai` | `openai-compatible` |
| `openrouter` | `https://openrouter.ai/api/v1` | `openai-compatible` |
| `siliconflow` | `https://api.siliconflow.cn/v1` | `openai-compatible` |
| `xai` | `https://api.x.ai/v1` | `openai-compatible` |
| `zai` | `https://api.z.ai/api/paas/v4` | `openai-compatible` |
| `zhipu` | `https://open.bigmodel.cn/api/paas/v4` | `openai-compatible` |

To disable auto-detection: `envProvider({ presetAutoDetect: false })`. See [Advanced Usage](./docs/advanced.md#preset-auto-detect) for details.

## Documentation

- **[API Reference](./docs/api-reference.md)** — `envProvider()` options, types, model ID format
- **[Advanced Usage](./docs/advanced.md)** — Code-based configs, custom fetch/headers, custom separator, provider registry
- **[Bundler Usage](./docs/bundler.md)** — For `bun build`, `vite build`, and other bundlers
