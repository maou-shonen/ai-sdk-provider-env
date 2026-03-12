# AGENTS.md — ai-sdk-provider-env

Environment-variable-driven provider for Vercel AI SDK.

## Commands

```bash
bun install            # Package manager: bun only
bun run build          # tsdown → dist/ (ESM + CJS)
bun test               # Bun test runner
bun test src/env-provider.test.ts              # Single file
bun test --test-name-pattern "should create"   # Filter by name
bun run lint:fix       # ESLint (@antfu/eslint-config, type: lib)
bun run typecheck      # tsc --noEmit, strict
```

## Structure

```
src/
├── index.ts              # Barrel export — all public API
├── types.ts              # Shared interfaces
├── env-provider.ts       # Core: createEnvProvider(), envProvider()
├── env-provider.test.ts  # Tests (DI, no module mocking)
├── factories.ts          # Dynamic require() wrappers for optional peer deps
├── presets.ts            # Built-in preset configs
└── presets.test.ts
```

- Tests co-located: `foo.ts` → `foo.test.ts`
- All public exports go through `index.ts`
- `llms.txt` — LLM-facing quick reference (published with npm). Covers: install, core concept, env vars, presets, options, compatibility modes, common patterns, exports. Keep in sync when public API or presets change.

## Architecture

- **Optional peer deps**: `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible` — dynamic `require()` in `factories.ts`
- **Config priority**: explicit `configs` option > env vars > presets
- **Provider caching**: by uppercase config set name in `Map`
- **Model ID**: `{configSet}/{modelId}` — first `/` splits; rest passed as-is
- **Testing**: DI via `ProviderFactories` interface → `createEnvProvider(factories, opts)` is testable entry; `envProvider()` is public wrapper. Env vars isolated via backup/restore in beforeEach/afterEach.
- **Error messages**: prefixed `[ai-sdk-provider-env]`, must be actionable (include missing var name, available presets, etc.)

## Task Completion

```bash
bun run lint:fix && bun run typecheck && bun test && bun run build
```

All four must pass. New logic requires new tests.
