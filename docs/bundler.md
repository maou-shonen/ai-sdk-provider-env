# Bundler Usage

This library uses dynamic `require()` to load optional peer dependencies at runtime. This works out of the box for **Node.js / Bun servers** where `node_modules` is available. If you use a **bundler**, choose one of the approaches below depending on your deployment target.

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

Only provide the factories you actually use. If a config set resolves to a compatibility mode without a matching factory, a clear error is thrown at runtime.

### Factory key mapping

| `compatible` value | `factories` key | Package |
|---|---|---|
| `openai` | `openai` | `@ai-sdk/openai` |
| `anthropic` | `anthropic` | `@ai-sdk/anthropic` |
| `gemini` | `gemini` | `@ai-sdk/google` |
| `openai-compatible` | `openaiCompatible` | `@ai-sdk/openai-compatible` |

### How it works

When `factories` is provided, the library uses **lazy-strict** semantics:

- Factories you provide are used in place of the built-in dynamic `require()`.
- Factories you **don't** provide will throw a descriptive error **only if** a config set actually needs that compatibility mode at runtime.
- There is **no silent fallback** to dynamic `require()` — if you opt into `factories`, the bundler-safe guarantee is strict.

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
