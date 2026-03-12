# Bundler Usage

This library uses dynamic `require()` to load provider SDKs (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`) at runtime. This works out of the box for **Node.js / Bun servers** where `node_modules` is available. If you use a **bundler**, choose one of the approaches below depending on your deployment target.

## Approach 1: Mark packages as external (recommended for server-side)

If your bundled output runs in an environment with `node_modules` (Docker, traditional servers, most serverless platforms), simply externalize the packages:

```bash
# Bun
bun build --packages=external

# Or target specific packages
bun build --external '@ai-sdk/*'
```

For esbuild, webpack, or Vite, use the equivalent `external` configuration.

## Approach 2: Provide explicit factories (recommended for single-file / compile)

If your bundled output must be fully self-contained (e.g. `bun build --compile`), pass factory functions via static imports so the bundler can trace and include them:

```ts
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { envProvider } from 'ai-sdk-provider-env'

const provider = envProvider({
  factories: {
    openai: createOpenAI,
    anthropic: createAnthropic,
  },
})
```

Only provide the factories you actually use. Missing factories are handled based on the compatibility mode:

- **`openai`**: Falls back to `@ai-sdk/openai-compatible` automatically in environments with `node_modules` (no error). For single-file / compile builds, provide either `openai` or `openaiCompatible` factory.
- **`anthropic` / `gemini`**: A clear error is thrown at runtime — these have no fallback.
- **`openai-compatible`**: Available automatically in environments with `node_modules` (it's a regular dependency). For single-file / compile builds, provide an explicit factory if you use this mode directly.

### Factory key mapping

| `compatible` value | `factories` key | Package | Fallback |
|---|---|---|---|
| `openai` | `openai` | `@ai-sdk/openai` | `openai-compatible` |
| `anthropic` | `anthropic` | `@ai-sdk/anthropic` | None (error) |
| `gemini` | `gemini` | `@ai-sdk/google` | None (error) |
| `openai-compatible` | `openaiCompatible` | `@ai-sdk/openai-compatible` | Built-in (via `node_modules`) |

### How it works

When `factories` is provided, the library uses **lazy-strict** semantics:

- Factories you provide are used in place of the built-in dynamic `require()`.
- If `openai` is not provided, the library falls back to `@ai-sdk/openai-compatible` via dynamic `require()`. This works in environments with `node_modules`; for single-file builds, provide either `openai` or `openaiCompatible` factory explicitly.
- For `anthropic` and `gemini`, missing factories throw a descriptive error — these providers have no OpenAI-compatible fallback.
- `openaiCompatible` falls back to the built-in `@ai-sdk/openai-compatible` via dynamic `require()` if not provided. This works in environments with `node_modules`; for single-file builds, provide the factory explicitly.

### Combining with other options

`factories` works alongside all other `envProvider` options (`configs`, `defaults`, `presetAutoDetect`, etc.):

```ts
import { createOpenAI } from '@ai-sdk/openai'
import { envProvider } from 'ai-sdk-provider-env'

const provider = envProvider({
  factories: { openai: createOpenAI },
  configs: {
    myapi: {
      preset: 'openai',
      apiKey: process.env.MY_API_KEY!,
    },
  },
  defaults: {
    headers: { 'X-App': 'my-app' },
  },
})
```
