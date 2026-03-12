import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  shims: true,
  sourcemap: true,
  deps: {
    // These are optional runtime dependencies loaded via dynamic require().
    // They may not be installed and should never be bundled.
    neverBundle: ['@ai-sdk/openai', '@ai-sdk/anthropic', '@ai-sdk/google'],
  },
})
