import type { ProviderV3 } from '@ai-sdk/provider'
import type { ProviderFactories } from './env-provider'
import type { ProviderV3Compatible } from './types'
import { NoSuchModelError } from '@ai-sdk/provider'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { createEnvProvider, envProvider } from './env-provider'
import { isModuleNotFoundError } from './factories'

// --- Mock helpers ---

function createMockProvider(providerName: string): ProviderV3 {
  return {
    specificationVersion: 'v3' as const,
    languageModel: mock((modelId: string) => ({
      specificationVersion: 'v3' as const,
      provider: providerName,
      modelId,
      supportedUrls: {},
      doGenerate: mock(),
      doStream: mock(),
    })),
    embeddingModel: mock((modelId: string) => ({
      specificationVersion: 'v3' as const,
      provider: providerName,
      modelId,
    })),
    imageModel: mock((modelId: string) => ({
      specificationVersion: 'v3' as const,
      provider: providerName,
      modelId,
    })),
    textEmbeddingModel: mock((modelId: string) => ({
      specificationVersion: 'v3' as const,
      provider: providerName,
      modelId,
    })),
    transcriptionModel: mock((modelId: string) => ({
      specificationVersion: 'v3' as const,
      provider: providerName,
      modelId,
    })),
    speechModel: mock((modelId: string) => ({
      specificationVersion: 'v3' as const,
      provider: providerName,
      modelId,
    })),
    rerankingModel: mock((modelId: string) => ({
      specificationVersion: 'v3' as const,
      provider: providerName,
      modelId,
    })),
  } as unknown as ProviderV3
}

/**
 * Create a V4-style mock provider (specificationVersion: 'v4', no textEmbeddingModel).
 * Simulates what @ai-sdk/openai@4.x returns.
 */
function createMockV4Provider(providerName: string): ProviderV3Compatible {
  return {
    specificationVersion: 'v4' as const,
    languageModel: mock((modelId: string) => ({
      specificationVersion: 'v4' as const,
      provider: providerName,
      modelId,
      supportedUrls: {},
      doGenerate: mock(),
      doStream: mock(),
    })),
    embeddingModel: mock((modelId: string) => ({
      specificationVersion: 'v4' as const,
      provider: providerName,
      modelId,
    })),
    imageModel: mock((modelId: string) => ({
      specificationVersion: 'v4' as const,
      provider: providerName,
      modelId,
    })),
    transcriptionModel: mock((modelId: string) => ({
      specificationVersion: 'v4' as const,
      provider: providerName,
      modelId,
    })),
    speechModel: mock((modelId: string) => ({
      specificationVersion: 'v4' as const,
      provider: providerName,
      modelId,
    })),
    rerankingModel: mock((modelId: string) => ({
      specificationVersion: 'v4' as const,
      provider: providerName,
      modelId,
    })),
  }
}

/**
 * Create a set of mock factories and the corresponding ProviderFactories.
 * Each mock factory produces a trackable mock provider based on the given opts.
 */
function createMockFactories() {
  const mockCreateOpenAI = mock((opts: any) =>
    createMockProvider(`openai[${opts.baseURL}]`),
  )
  const mockCreateAnthropic = mock((opts: any) =>
    createMockProvider(`anthropic[${opts.baseURL}]`),
  )
  const mockCreateGemini = mock((opts: any) =>
    createMockProvider(`gemini[${opts.baseURL}]`),
  )
  const mockCreateOpenAICompatible = mock((opts: any) =>
    createMockProvider(`openai-compatible[${opts.name}]`),
  )

  const factories: ProviderFactories = {
    createOpenAI: mockCreateOpenAI,
    createAnthropic: mockCreateAnthropic,
    createGemini: mockCreateGemini,
    createOpenAICompatible: mockCreateOpenAICompatible,
  }

  return { factories, mockCreateOpenAI, mockCreateAnthropic, mockCreateGemini, mockCreateOpenAICompatible }
}

// --- Env var helpers ---

const envBackup: Record<string, string | undefined> = {}

function setEnv(key: string, value: string) {
  envBackup[key] = process.env[key]
  process.env[key] = value
}

function clearTestEnv() {
  for (const [key, original] of Object.entries(envBackup)) {
    if (original === undefined)
      delete process.env[key]
    else
      process.env[key] = original
  }
  for (const key in envBackup)
    delete envBackup[key]
}

// --- Tests ---

describe('isModuleNotFoundError', () => {
  it('should match when quoted module name matches the package', () => {
    const error = Object.assign(
      new Error("Cannot find module '@ai-sdk/openai'"),
      { code: 'MODULE_NOT_FOUND' },
    )
    expect(isModuleNotFoundError(error, '@ai-sdk/openai')).toBe(true)
  })

  it('should match sub-path imports of the target package', () => {
    const error = Object.assign(
      new Error("Cannot find module '@ai-sdk/openai/internal'"),
      { code: 'MODULE_NOT_FOUND' },
    )
    expect(isModuleNotFoundError(error, '@ai-sdk/openai')).toBe(true)
  })

  it('should NOT match when target package only appears in require stack', () => {
    // Simulate: a sub-dependency of @ai-sdk/openai fails to load,
    // but @ai-sdk/openai appears in the require stack
    const error = Object.assign(
      new Error(
        "Cannot find module 'some-missing-dep'\n"
        + 'Require stack:\n'
        + '- /node_modules/@ai-sdk/openai/dist/index.js',
      ),
      { code: 'MODULE_NOT_FOUND' },
    )
    expect(isModuleNotFoundError(error, '@ai-sdk/openai')).toBe(false)
  })

  it('should NOT match a different package with same prefix', () => {
    const error = Object.assign(
      new Error("Cannot find module '@ai-sdk/openai-compatible'"),
      { code: 'MODULE_NOT_FOUND' },
    )
    // Should NOT match @ai-sdk/openai (different package)
    expect(isModuleNotFoundError(error, '@ai-sdk/openai')).toBe(false)
  })

  it('should match double-quoted module names', () => {
    const error = Object.assign(
      new Error('Cannot find module "@ai-sdk/openai"'),
      { code: 'MODULE_NOT_FOUND' },
    )
    expect(isModuleNotFoundError(error, '@ai-sdk/openai')).toBe(true)
  })

  it('should NOT match a different package with same prefix in double quotes', () => {
    const error = Object.assign(
      new Error('Cannot find module "@ai-sdk/openai-compatible"'),
      { code: 'MODULE_NOT_FOUND' },
    )
    expect(isModuleNotFoundError(error, '@ai-sdk/openai')).toBe(false)
  })

  it('should work with Bun compiled binary errors (no error.code)', () => {
    const error = new Error("Cannot find module '@ai-sdk/anthropic'")
    expect(isModuleNotFoundError(error, '@ai-sdk/anthropic')).toBe(true)
  })

  it('should return false for non-module-not-found errors', () => {
    const error = new Error('Unexpected error')
    expect(isModuleNotFoundError(error, '@ai-sdk/openai')).toBe(false)
  })

  it('should return false for non-object errors', () => {
    expect(isModuleNotFoundError('string error', '@ai-sdk/openai')).toBe(false)
    expect(isModuleNotFoundError(null, '@ai-sdk/openai')).toBe(false)
  })
})

describe('envProvider', () => {
  let mockCreateOpenAI: ReturnType<typeof createMockFactories>['mockCreateOpenAI']
  let mockCreateAnthropic: ReturnType<typeof createMockFactories>['mockCreateAnthropic']
  let mockCreateGemini: ReturnType<typeof createMockFactories>['mockCreateGemini']
  let mockCreateOpenAICompatible: ReturnType<typeof createMockFactories>['mockCreateOpenAICompatible']
  let factories: ProviderFactories

  beforeEach(() => {
    ({ factories, mockCreateOpenAI, mockCreateAnthropic, mockCreateGemini, mockCreateOpenAICompatible } = createMockFactories())
  })

  afterEach(() => {
    clearTestEnv()
  })

  describe('env var resolution', () => {
    it('should create openai-compatible provider by default', () => {
      setEnv('MYAPI_BASE_URL', 'https://api.example.com/v1')
      setEnv('MYAPI_API_KEY', 'test-key')

      const provider = createEnvProvider(factories)
      provider.languageModel('myapi/some-model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'myapi',
        baseURL: 'https://api.example.com/v1',
        apiKey: 'test-key',
      })
    })

    it('should create openai provider when COMPATIBLE=openai', () => {
      setEnv('MYAPI_BASE_URL', 'https://api.openai.com/v1')
      setEnv('MYAPI_API_KEY', 'test-key')
      setEnv('MYAPI_COMPATIBLE', 'openai')

      const provider = createEnvProvider(factories)
      provider.languageModel('myapi/gpt-4o')

      expect(mockCreateOpenAI).toHaveBeenCalledWith({
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
      })
    })

    it('should create anthropic provider when COMPATIBLE=anthropic', () => {
      setEnv('CLAUDE_BASE_URL', 'https://api.anthropic.com')
      setEnv('CLAUDE_API_KEY', 'test-key')
      setEnv('CLAUDE_COMPATIBLE', 'anthropic')

      const provider = createEnvProvider(factories)
      provider.languageModel('claude/claude-sonnet-4-20250514')

      expect(mockCreateAnthropic).toHaveBeenCalledWith({
        baseURL: 'https://api.anthropic.com',
        apiKey: 'test-key',
      })
      expect(mockCreateOpenAI).not.toHaveBeenCalled()
    })

    it('should create gemini provider when COMPATIBLE=gemini', () => {
      setEnv('MYAPI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta')
      setEnv('MYAPI_API_KEY', 'test-key')
      setEnv('MYAPI_COMPATIBLE', 'gemini')

      const provider = createEnvProvider(factories)
      provider.languageModel('myapi/gemini-2.0-flash')

      expect(mockCreateGemini).toHaveBeenCalledWith({
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'test-key',
      })
      expect(mockCreateOpenAI).not.toHaveBeenCalled()
    })

    it('should throw on unknown compatible values', () => {
      setEnv('CUSTOM_BASE_URL', 'https://api.custom.com/v1')
      setEnv('CUSTOM_API_KEY', 'test-key')
      setEnv('CUSTOM_COMPATIBLE', 'my-custom-provider')

      const provider = createEnvProvider(factories)

      expect(() => provider.languageModel('custom/my-model'))
        .toThrow('Unknown compatible mode')
    })

    it('should pass modelId correctly to the underlying provider', () => {
      setEnv('TEST_BASE_URL', 'https://api.example.com/v1')
      setEnv('TEST_API_KEY', 'key')

      const provider = createEnvProvider(factories)
      provider.languageModel('test/gpt-4o')

      const mockProvider = mockCreateOpenAICompatible.mock.results[0].value as ProviderV3
      expect(mockProvider.languageModel).toHaveBeenCalledWith('gpt-4o')
    })

    it('should handle modelId with multiple slashes', () => {
      setEnv('TEST_BASE_URL', 'https://api.example.com/v1')
      setEnv('TEST_API_KEY', 'key')

      const provider = createEnvProvider(factories)
      provider.languageModel('test/org/model-name')

      const mockProvider = mockCreateOpenAICompatible.mock.results[0].value as ProviderV3
      expect(mockProvider.languageModel).toHaveBeenCalledWith('org/model-name')
    })

    it('should uppercase the config set name for env var lookup', () => {
      setEnv('MYAPI_BASE_URL', 'https://api.example.com/v1')
      setEnv('MYAPI_API_KEY', 'key')

      const provider = createEnvProvider(factories)
      provider.languageModel('myApi/some-model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'myApi',
        baseURL: 'https://api.example.com/v1',
        apiKey: 'key',
      })
    })
  })

  describe('config set name validation', () => {
    it('should accept names with hyphens and normalize to underscores', () => {
      setEnv('FOO_BAR_BASE_URL', 'https://api.example.com/v1')
      setEnv('FOO_BAR_API_KEY', 'test-key')

      const provider = createEnvProvider(factories)
      provider.languageModel('foo-bar/some-model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'foo-bar',
        baseURL: 'https://api.example.com/v1',
        apiKey: 'test-key',
      })
    })

    it('should normalize multiple hyphens in config set name', () => {
      setEnv('FOO_BAR_BAZ_BASE_URL', 'https://api.example.com/v1')
      setEnv('FOO_BAR_BAZ_API_KEY', 'test-key')

      const provider = createEnvProvider(factories)
      provider.languageModel('foo-bar-baz/model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'foo-bar-baz',
        baseURL: 'https://api.example.com/v1',
        apiKey: 'test-key',
      })
    })

    it('should accept names with underscores (unchanged)', () => {
      setEnv('FOO_BAR_BASE_URL', 'https://api.example.com/v1')
      setEnv('FOO_BAR_API_KEY', 'test-key')

      const provider = createEnvProvider(factories)
      provider.languageModel('foo_bar/model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'foo_bar',
        baseURL: 'https://api.example.com/v1',
        apiKey: 'test-key',
      })
    })

    it('should accept names starting with underscore', () => {
      setEnv('_INTERNAL_BASE_URL', 'https://api.example.com/v1')
      setEnv('_INTERNAL_API_KEY', 'test-key')

      const provider = createEnvProvider(factories)
      provider.languageModel('_internal/model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: '_internal',
        baseURL: 'https://api.example.com/v1',
        apiKey: 'test-key',
      })
    })

    it('should reject names starting with a digit', () => {
      const provider = createEnvProvider(factories)
      expect(() => provider.languageModel('123api/model'))
        .toThrow('Invalid config set name')
    })

    it('should reject names with only hyphens', () => {
      const provider = createEnvProvider(factories)
      expect(() => provider.languageModel('---/model'))
        .toThrow('Invalid config set name')
    })

    it('should reject names with non-ASCII characters', () => {
      const provider = createEnvProvider(factories)
      expect(() => provider.languageModel('café/model'))
        .toThrow('Invalid config set name')
    })

    it('should reject names with spaces', () => {
      const provider = createEnvProvider(factories)
      expect(() => provider.languageModel('foo bar/model'))
        .toThrow('Invalid config set name')
    })

    it('should reject names with dots', () => {
      const provider = createEnvProvider(factories)
      expect(() => provider.languageModel('foo.bar/model'))
        .toThrow('Invalid config set name')
    })

    it('should mention configs option in validation error', () => {
      const provider = createEnvProvider(factories)
      expect(() => provider.languageModel('café/model'))
        .toThrow('configs option')
    })

    it('should bypass validation for explicit configs', () => {
      const provider = createEnvProvider(factories, {
        configs: {
          'café': {
            baseURL: 'https://api.example.com/v1',
            apiKey: 'test-key',
          },
        },
      })

      // Should NOT throw — configs bypasses name validation
      provider.languageModel('café/model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'café',
        baseURL: 'https://api.example.com/v1',
        apiKey: 'test-key',
      })
    })

    it('should show normalized prefix in error messages', () => {
      setEnv('MY_API_BASE_URL', 'https://api.example.com/v1')

      const provider = createEnvProvider(factories)
      const err = (() => {
        try { provider.languageModel('my-api/model') }
        catch (e) { return e as Error }
      })()

      // Error should mention MY_API_API_KEY (normalized), not MY-API_API_KEY
      expect(err?.message).toContain('MY_API_API_KEY')
    })
  })

  describe('error handling', () => {
    it('should throw when API_KEY is missing', () => {
      setEnv('NOKEY_BASE_URL', 'https://api.example.com/v1')

      const provider = createEnvProvider(factories)
      expect(() => provider.languageModel('nokey/model'))
        .toThrow('NOKEY_API_KEY')
    })

    it('should throw when BASE_URL is missing and no PRESET set', () => {
      setEnv('NOURL_API_KEY', 'test-key')

      const provider = createEnvProvider(factories)
      expect(() => provider.languageModel('nourl/model'))
        .toThrow('NOURL_BASE_URL')
    })

    it('should throw on invalid modelId format', () => {
      const provider = createEnvProvider(factories)
      expect(() => provider.languageModel('no-slash'))
        .toThrow('Expected format')
    })
  })

  describe('configs option', () => {
    it('should take precedence over env vars', () => {
      setEnv('CODE_BASE_URL', 'https://env-url.com')
      setEnv('CODE_API_KEY', 'env-key')

      const provider = createEnvProvider(factories, {
        configs: {
          code: {
            baseURL: 'https://code-url.com',
            apiKey: 'code-key',
            compatible: 'openai',
          },
        },
      })
      provider.languageModel('code/model')

      expect(mockCreateOpenAI).toHaveBeenCalledWith({
        baseURL: 'https://code-url.com',
        apiKey: 'code-key',
      })
    })

    it('should respect compatible setting in configs', () => {
      const provider = createEnvProvider(factories, {
        configs: {
          test: {
            baseURL: 'https://api.test.com',
            apiKey: 'key',
            compatible: 'anthropic',
          },
        },
      })
      provider.languageModel('test/model')

      expect(mockCreateAnthropic).toHaveBeenCalled()
      expect(mockCreateOpenAI).not.toHaveBeenCalled()
    })

    it('should use configs even when PRESET env var is set', () => {
      setEnv('CODE_PRESET', 'deepseek')
      setEnv('CODE_API_KEY', 'env-key')

      const provider = createEnvProvider(factories, {
        configs: {
          code: {
            baseURL: 'https://explicit.com',
            apiKey: 'explicit-key',
            compatible: 'anthropic',
          },
        },
      })
      provider.languageModel('code/model')

      // Explicit configs take precedence over PRESET env var
      expect(mockCreateAnthropic).toHaveBeenCalledWith({
        baseURL: 'https://explicit.com',
        apiKey: 'explicit-key',
      })
      expect(mockCreateOpenAI).not.toHaveBeenCalled()
    })

    it('should pass headers from configs to underlying provider', () => {
      const provider = createEnvProvider(factories, {
        configs: {
          test: {
            baseURL: 'https://api.test.com',
            apiKey: 'key',
            headers: { 'X-Custom': 'value' },
          },
        },
      })
      provider.languageModel('test/model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'test',
        baseURL: 'https://api.test.com',
        apiKey: 'key',
        headers: { 'X-Custom': 'value' },
      })
    })

    it('should throw when configs has no baseURL and no preset', () => {
      const provider = createEnvProvider(factories, {
        configs: {
          bad: { apiKey: 'key' },
        },
      })

      expect(() => provider.languageModel('bad/model'))
        .toThrow('Missing baseURL')
    })

    describe('preset in configs', () => {
      it('should resolve baseURL and compatible from preset', () => {
        const provider = createEnvProvider(factories, {
          configs: {
            ds: {
              preset: 'deepseek',
              apiKey: 'ds-key',
            },
          },
        })
        provider.languageModel('ds/deepseek-chat')

        expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
          name: 'ds',
          baseURL: 'https://api.deepseek.com',
          apiKey: 'ds-key',
        })
      })

      it('should allow baseURL override with preset in configs', () => {
        const provider = createEnvProvider(factories, {
          configs: {
            ds: {
              preset: 'deepseek',
              apiKey: 'ds-key',
              baseURL: 'https://my-proxy.com/deepseek',
            },
          },
        })
        provider.languageModel('ds/model')

        expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
          name: 'ds',
          baseURL: 'https://my-proxy.com/deepseek',
          apiKey: 'ds-key',
        })
      })

      it('should allow compatible override with preset in configs', () => {
        const provider = createEnvProvider(factories, {
          configs: {
            ds: {
              preset: 'deepseek',
              apiKey: 'ds-key',
              compatible: 'anthropic',
            },
          },
        })
        provider.languageModel('ds/model')

        expect(mockCreateAnthropic).toHaveBeenCalled()
        expect(mockCreateOpenAICompatible).not.toHaveBeenCalled()
      })

      it('should pass headers with preset in configs', () => {
        const provider = createEnvProvider(factories, {
          configs: {
            ds: {
              preset: 'deepseek',
              apiKey: 'ds-key',
              headers: { 'X-Custom': 'value' },
            },
          },
        })
        provider.languageModel('ds/model')

        expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
          name: 'ds',
          baseURL: 'https://api.deepseek.com',
          apiKey: 'ds-key',
          headers: { 'X-Custom': 'value' },
        })
      })

      it('should throw on unknown preset in configs', () => {
        const provider = createEnvProvider(factories, {
          configs: {
            bad: {
              preset: 'nonexistent',
              apiKey: 'key',
            },
          },
        })

        expect(() => provider.languageModel('bad/model'))
          .toThrow('Unknown preset')
      })
    })
  })

  describe('custom separator', () => {
    it('should support custom env separator', () => {
      setEnv('MYAPI__BASE_URL', 'https://api.example.com/v1')
      setEnv('MYAPI__API_KEY', 'test-key')

      const provider = createEnvProvider(factories, { separator: '__' })
      provider.languageModel('myapi/some-model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'myapi',
        baseURL: 'https://api.example.com/v1',
        apiKey: 'test-key',
      })
    })

    it('should work with presets under custom separator', () => {
      setEnv('DS__API_KEY', 'key')
      setEnv('DS__PRESET', 'deepseek')

      const provider = createEnvProvider(factories, { separator: '__' })
      provider.languageModel('ds/model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'ds',
        baseURL: 'https://api.deepseek.com',
        apiKey: 'key',
      })
    })

    it('should reject separator containing hyphens on env-var resolution', () => {
      const provider = createEnvProvider(factories, { separator: '-' })
      // Does NOT throw at creation — only when env-var path is hit
      expect(() => provider.languageModel('myapi/model'))
        .toThrow('Invalid separator')
    })

    it('should reject separator containing spaces on env-var resolution', () => {
      const provider = createEnvProvider(factories, { separator: ' ' })
      expect(() => provider.languageModel('myapi/model'))
        .toThrow('Invalid separator')
    })

    it('should reject empty separator on env-var resolution', () => {
      const provider = createEnvProvider(factories, { separator: '' })
      expect(() => provider.languageModel('myapi/model'))
        .toThrow('Invalid separator')
    })

    it('should accept separator with letters and digits', () => {
      setEnv('MYAPIx0xBASE_URL', 'https://api.example.com/v1')
      setEnv('MYAPIx0xAPI_KEY', 'test-key')

      const provider = createEnvProvider(factories, { separator: 'x0x' })
      provider.languageModel('myapi/model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'myapi',
        baseURL: 'https://api.example.com/v1',
        apiKey: 'test-key',
      })
    })

    it('should allow invalid separator when only configs path is used', () => {
      const provider = createEnvProvider(factories, {
        separator: '-',
        configs: {
          myapi: {
            baseURL: 'https://api.example.com/v1',
            apiKey: 'test-key',
          },
        },
      })

      // Should NOT throw — configs bypasses separator validation
      provider.languageModel('myapi/model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'myapi',
        baseURL: 'https://api.example.com/v1',
        apiKey: 'test-key',
      })
    })
  })

  describe('defaults option', () => {
    describe('defaults.fetch', () => {
      it('should pass custom fetch to openai-compatible provider', () => {
        setEnv('TEST_BASE_URL', 'https://api.example.com/v1')
        setEnv('TEST_API_KEY', 'key')

        const customFetch = mock() as unknown as typeof globalThis.fetch
        const provider = createEnvProvider(factories, { defaults: { fetch: customFetch } })
        provider.languageModel('test/model')

        expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
          name: 'test',
          baseURL: 'https://api.example.com/v1',
          apiKey: 'key',
          fetch: customFetch,
        })
      })

      it('should pass custom fetch to anthropic provider', () => {
        setEnv('TEST_BASE_URL', 'https://api.anthropic.com')
        setEnv('TEST_API_KEY', 'key')
        setEnv('TEST_COMPATIBLE', 'anthropic')

        const customFetch = mock() as unknown as typeof globalThis.fetch
        const provider = createEnvProvider(factories, { defaults: { fetch: customFetch } })
        provider.languageModel('test/model')

        expect(mockCreateAnthropic).toHaveBeenCalledWith({
          baseURL: 'https://api.anthropic.com',
          apiKey: 'key',
          fetch: customFetch,
        })
      })

      it('should pass custom fetch to gemini provider', () => {
        setEnv('TEST_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta')
        setEnv('TEST_API_KEY', 'key')
        setEnv('TEST_COMPATIBLE', 'gemini')

        const customFetch = mock() as unknown as typeof globalThis.fetch
        const provider = createEnvProvider(factories, { defaults: { fetch: customFetch } })
        provider.languageModel('test/gemini-2.0-flash')

        expect(mockCreateGemini).toHaveBeenCalledWith({
          baseURL: 'https://generativelanguage.googleapis.com/v1beta',
          apiKey: 'key',
          fetch: customFetch,
        })
      })

      it('should pass custom fetch to explicit openai-compatible provider', () => {
        setEnv('TEST_BASE_URL', 'https://api.custom.com/v1')
        setEnv('TEST_API_KEY', 'key')
        setEnv('TEST_COMPATIBLE', 'openai-compatible')

        const customFetch = mock() as unknown as typeof globalThis.fetch
        const provider = createEnvProvider(factories, { defaults: { fetch: customFetch } })
        provider.languageModel('test/model')

        expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
          name: 'test',
          baseURL: 'https://api.custom.com/v1',
          apiKey: 'key',
          fetch: customFetch,
        })
      })
    })

    describe('defaults.headers', () => {
      it('should apply default headers to all providers', () => {
        setEnv('TEST_BASE_URL', 'https://api.example.com/v1')
        setEnv('TEST_API_KEY', 'key')

        const provider = createEnvProvider(factories, {
          defaults: { headers: { 'X-App': 'my-app' } },
        })
        provider.languageModel('test/model')

        expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
          name: 'test',
          baseURL: 'https://api.example.com/v1',
          apiKey: 'key',
          headers: { 'X-App': 'my-app' },
        })
      })

      it('should be overridden by config-set headers (env var)', () => {
        setEnv('TEST_BASE_URL', 'https://api.example.com/v1')
        setEnv('TEST_API_KEY', 'key')
        setEnv('TEST_HEADERS', '{"X-App":"override","X-Extra":"extra"}')

        const provider = createEnvProvider(factories, {
          defaults: { headers: { 'X-App': 'default', 'X-Default': 'kept' } },
        })
        provider.languageModel('test/model')

        expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
          name: 'test',
          baseURL: 'https://api.example.com/v1',
          apiKey: 'key',
          headers: { 'X-App': 'override', 'X-Default': 'kept', 'X-Extra': 'extra' },
        })
      })

      it('should be overridden by config-set headers (code config)', () => {
        const provider = createEnvProvider(factories, {
          defaults: { headers: { 'X-App': 'default', 'X-Default': 'kept' } },
          configs: {
            test: {
              baseURL: 'https://api.test.com',
              apiKey: 'key',
              headers: { 'X-App': 'override' },
            },
          },
        })
        provider.languageModel('test/model')

        expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
          name: 'test',
          baseURL: 'https://api.test.com',
          apiKey: 'key',
          headers: { 'X-App': 'override', 'X-Default': 'kept' },
        })
      })

      it('should combine defaults.fetch and defaults.headers', () => {
        setEnv('TEST_BASE_URL', 'https://api.example.com/v1')
        setEnv('TEST_API_KEY', 'key')

        const customFetch = mock() as unknown as typeof globalThis.fetch
        const provider = createEnvProvider(factories, {
          defaults: {
            fetch: customFetch,
            headers: { 'X-App': 'my-app' },
          },
        })
        provider.languageModel('test/model')

        expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
          name: 'test',
          baseURL: 'https://api.example.com/v1',
          apiKey: 'key',
          headers: { 'X-App': 'my-app' },
          fetch: customFetch,
        })
      })
    })
  })

  describe('headers env var', () => {
    it('should parse HEADERS env var as JSON', () => {
      setEnv('TEST_BASE_URL', 'https://api.example.com/v1')
      setEnv('TEST_API_KEY', 'key')
      setEnv('TEST_HEADERS', '{"X-Custom":"value","X-Other":"bar"}')

      const provider = createEnvProvider(factories)
      provider.languageModel('test/model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'test',
        baseURL: 'https://api.example.com/v1',
        apiKey: 'key',
        headers: { 'X-Custom': 'value', 'X-Other': 'bar' },
      })
    })

    it('should throw on invalid HEADERS JSON', () => {
      setEnv('TEST_BASE_URL', 'https://api.example.com/v1')
      setEnv('TEST_API_KEY', 'key')
      setEnv('TEST_HEADERS', 'not-json')

      const provider = createEnvProvider(factories)
      expect(() => provider.languageModel('test/model'))
        .toThrow('Invalid JSON')
    })

    it('should work with headers and preset together', () => {
      setEnv('DS_API_KEY', 'key')
      setEnv('DS_PRESET', 'deepseek')
      setEnv('DS_HEADERS', '{"X-Custom":"value"}')

      const provider = createEnvProvider(factories)
      provider.languageModel('ds/model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'ds',
        baseURL: 'https://api.deepseek.com',
        apiKey: 'key',
        headers: { 'X-Custom': 'value' },
      })
    })

    it('should combine env headers and defaults.fetch', () => {
      setEnv('TEST_BASE_URL', 'https://api.example.com/v1')
      setEnv('TEST_API_KEY', 'key')
      setEnv('TEST_HEADERS', '{"X-Custom":"value"}')

      const customFetch = mock() as unknown as typeof globalThis.fetch
      const provider = createEnvProvider(factories, { defaults: { fetch: customFetch } })
      provider.languageModel('test/model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'test',
        baseURL: 'https://api.example.com/v1',
        apiKey: 'key',
        headers: { 'X-Custom': 'value' },
        fetch: customFetch,
      })
    })
  })

  describe('preset auto-detect', () => {
    // Core Functionality

    it('should auto-detect deepseek preset when only DEEPSEEK_API_KEY is set', () => {
      setEnv('DEEPSEEK_API_KEY', 'ds-key')

      const provider = createEnvProvider(factories)
      provider.languageModel('deepseek/deepseek-chat')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'deepseek',
        baseURL: 'https://api.deepseek.com',
        apiKey: 'ds-key',
      })
    })

    it('should auto-detect openai preset when only OPENAI_API_KEY is set', () => {
      setEnv('OPENAI_API_KEY', 'sk-key')

      const provider = createEnvProvider(factories)
      provider.languageModel('openai/gpt-4o')

      expect(mockCreateOpenAI).toHaveBeenCalledWith({
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'sk-key',
      })
    })

    it('should auto-detect anthropic preset when only ANTHROPIC_API_KEY is set', () => {
      setEnv('ANTHROPIC_API_KEY', 'ant-key')

      const provider = createEnvProvider(factories)
      provider.languageModel('anthropic/claude-sonnet-4-20250514')

      expect(mockCreateAnthropic).toHaveBeenCalledWith({
        baseURL: 'https://api.anthropic.com',
        apiKey: 'ant-key',
      })
    })

    it('should auto-detect google preset when only GOOGLE_API_KEY is set', () => {
      setEnv('GOOGLE_API_KEY', 'google-key')

      const provider = createEnvProvider(factories)
      provider.languageModel('google/gemini-2.0-flash')

      expect(mockCreateGemini).toHaveBeenCalledWith({
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'google-key',
      })
    })

    it('should auto-detect openrouter preset with mixed-case configSet', () => {
      setEnv('OPENROUTER_API_KEY', 'or-key')

      const provider = createEnvProvider(factories)
      provider.languageModel('OpenRouter/some-model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'OpenRouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'or-key',
      })
    })

    it('should throw mentioning BASE_URL when configSet has no preset match', () => {
      setEnv('MYAPI_API_KEY', 'my-key')

      const provider = createEnvProvider(factories)
      expect(() => provider.languageModel('myapi/model'))
        .toThrow('MYAPI_BASE_URL')
    })

    // Option Behavior

    it('should throw when presetAutoDetect is false even if configSet matches a preset', () => {
      setEnv('OPENAI_API_KEY', 'sk-key')

      const provider = createEnvProvider(factories, { presetAutoDetect: false })
      expect(() => provider.languageModel('openai/gpt-4o'))
        .toThrow('OPENAI_BASE_URL')
    })

    it('should auto-detect when presetAutoDetect is explicitly true', () => {
      setEnv('OPENAI_API_KEY', 'sk-key')

      const provider = createEnvProvider(factories, { presetAutoDetect: true })
      provider.languageModel('openai/gpt-4o')

      expect(mockCreateOpenAI).toHaveBeenCalledWith({
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'sk-key',
      })
    })

    it('should auto-detect by default when no options are passed', () => {
      setEnv('OPENAI_API_KEY', 'sk-key')

      const provider = createEnvProvider(factories)
      provider.languageModel('openai/gpt-4o')

      expect(mockCreateOpenAI).toHaveBeenCalledWith({
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'sk-key',
      })
    })

    // Precedence

    it('should use PRESET env var over auto-detect when OPENAI_PRESET=deepseek', () => {
      setEnv('OPENAI_PRESET', 'deepseek')
      setEnv('OPENAI_API_KEY', 'sk-key')

      const provider = createEnvProvider(factories)
      provider.languageModel('openai/model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'openai',
        baseURL: 'https://api.deepseek.com',
        apiKey: 'sk-key',
      })
      expect(mockCreateOpenAI).not.toHaveBeenCalled()
    })

    it('should use BASE_URL env var over auto-detect when OPENAI_BASE_URL is set', () => {
      setEnv('OPENAI_BASE_URL', 'https://proxy.com')
      setEnv('OPENAI_API_KEY', 'sk-key')

      const provider = createEnvProvider(factories)
      provider.languageModel('openai/model')

      // BASE_URL path uses openai-compatible by default (no COMPATIBLE set)
      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'openai',
        baseURL: 'https://proxy.com',
        apiKey: 'sk-key',
      })
      expect(mockCreateOpenAI).not.toHaveBeenCalled()
    })

    it('should use code configs over auto-detect', () => {
      const provider = createEnvProvider(factories, {
        configs: {
          openai: {
            baseURL: 'https://explicit.com',
            apiKey: 'explicit-key',
            compatible: 'openai-compatible',
          },
        },
      })
      provider.languageModel('openai/model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'openai',
        baseURL: 'https://explicit.com',
        apiKey: 'explicit-key',
      })
      expect(mockCreateOpenAI).not.toHaveBeenCalled()
    })

    // Env Var Overrides with Auto-Detect

    it('should allow COMPATIBLE env var to override auto-detected preset compatible', () => {
      setEnv('DEEPSEEK_API_KEY', 'ds-key')
      setEnv('DEEPSEEK_COMPATIBLE', 'anthropic')

      const provider = createEnvProvider(factories)
      provider.languageModel('deepseek/model')

      expect(mockCreateAnthropic).toHaveBeenCalled()
      expect(mockCreateOpenAICompatible).not.toHaveBeenCalled()
    })

    it('should pass HEADERS env var when auto-detecting deepseek preset', () => {
      setEnv('DEEPSEEK_API_KEY', 'ds-key')
      setEnv('DEEPSEEK_HEADERS', '{"X-Custom":"value"}')

      const provider = createEnvProvider(factories)
      provider.languageModel('deepseek/model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'deepseek',
        baseURL: 'https://api.deepseek.com',
        apiKey: 'ds-key',
        headers: { 'X-Custom': 'value' },
      })
    })

    // Error Messages

    it('should mention MYAPI_BASE_URL and MYAPI_PRESET in error when no preset match and auto-detect on', () => {
      setEnv('MYAPI_API_KEY', 'my-key')

      const provider = createEnvProvider(factories)
      const err = (() => {
        try {
          provider.languageModel('myapi/model')
        }
        catch (e) {
          return e as Error
        }
      })()

      expect(err?.message).toContain('MYAPI_BASE_URL')
      expect(err?.message).toContain('MYAPI_PRESET')
    })

    it('should mention presetAutoDetect in error when auto-detect is disabled and configSet matches a preset', () => {
      setEnv('OPENAI_API_KEY', 'sk-key')

      const provider = createEnvProvider(factories, { presetAutoDetect: false })
      const err = (() => {
        try {
          provider.languageModel('openai/model')
        }
        catch (e) {
          return e as Error
        }
      })()

      expect(err?.message).toContain('presetAutoDetect')
    })

    // Custom Separator

    it('should auto-detect deepseek preset with custom separator __', () => {
      setEnv('DEEPSEEK__API_KEY', 'ds-key')

      const provider = createEnvProvider(factories, { separator: '__' })
      provider.languageModel('deepseek/model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'deepseek',
        baseURL: 'https://api.deepseek.com',
        apiKey: 'ds-key',
      })
    })
  })

  describe('openai fallback to openai-compatible', () => {
    it('should fall back to openai-compatible when createOpenAI throws MODULE_NOT_FOUND', () => {
      const moduleNotFoundError = Object.assign(
        new Error("Cannot find module '@ai-sdk/openai'"),
        { code: 'MODULE_NOT_FOUND' },
      )

      const { factories: f, mockCreateOpenAICompatible: mockCompat } = createMockFactories()
      f.createOpenAI = () => { throw moduleNotFoundError }

      setEnv('MYAPI_BASE_URL', 'https://api.openai.com/v1')
      setEnv('MYAPI_API_KEY', 'test-key')
      setEnv('MYAPI_COMPATIBLE', 'openai')

      const provider = createEnvProvider(f)
      provider.languageModel('myapi/gpt-4o')

      expect(mockCompat).toHaveBeenCalledWith({
        name: 'myapi',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
      })
    })

    it('should fall back to openai-compatible when createOpenAI throws ERR_MODULE_NOT_FOUND', () => {
      const moduleNotFoundError = Object.assign(
        new Error("Cannot find module '@ai-sdk/openai'"),
        { code: 'ERR_MODULE_NOT_FOUND' },
      )

      const { factories: f, mockCreateOpenAICompatible: mockCompat } = createMockFactories()
      f.createOpenAI = () => { throw moduleNotFoundError }

      setEnv('MYAPI_BASE_URL', 'https://api.openai.com/v1')
      setEnv('MYAPI_API_KEY', 'test-key')
      setEnv('MYAPI_COMPATIBLE', 'openai')

      const provider = createEnvProvider(f)
      provider.languageModel('myapi/gpt-4o')

      expect(mockCompat).toHaveBeenCalledWith({
        name: 'myapi',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
      })
    })

    it('should NOT fall back on non-module-not-found errors', () => {
      const { factories: f } = createMockFactories()
      f.createOpenAI = () => { throw new Error('Unexpected initialization error') }

      setEnv('MYAPI_BASE_URL', 'https://api.openai.com/v1')
      setEnv('MYAPI_API_KEY', 'test-key')
      setEnv('MYAPI_COMPATIBLE', 'openai')

      const provider = createEnvProvider(f)

      expect(() => provider.languageModel('myapi/gpt-4o'))
        .toThrow('Unexpected initialization error')
    })

    it('should NOT fall back on MODULE_NOT_FOUND for a different package', () => {
      const moduleNotFoundError = Object.assign(
        new Error("Cannot find module 'some-other-dep'"),
        { code: 'MODULE_NOT_FOUND' },
      )

      const { factories: f } = createMockFactories()
      f.createOpenAI = () => { throw moduleNotFoundError }

      setEnv('MYAPI_BASE_URL', 'https://api.openai.com/v1')
      setEnv('MYAPI_API_KEY', 'test-key')
      setEnv('MYAPI_COMPATIBLE', 'openai')

      const provider = createEnvProvider(f)

      expect(() => provider.languageModel('myapi/gpt-4o')).toThrow()
    })

    it('should use first-party SDK when available (no fallback)', () => {
      setEnv('MYAPI_BASE_URL', 'https://api.openai.com/v1')
      setEnv('MYAPI_API_KEY', 'test-key')
      setEnv('MYAPI_COMPATIBLE', 'openai')

      const provider = createEnvProvider(factories)
      provider.languageModel('myapi/gpt-4o')

      expect(mockCreateOpenAI).toHaveBeenCalled()
      expect(mockCreateOpenAICompatible).not.toHaveBeenCalled()
    })

    it('should NOT fall back for anthropic (no openai-compatible support)', () => {
      const moduleNotFoundError = Object.assign(
        new Error("Cannot find module '@ai-sdk/anthropic'"),
        { code: 'MODULE_NOT_FOUND' },
      )

      const { factories: f } = createMockFactories()
      f.createAnthropic = () => { throw moduleNotFoundError }

      setEnv('MYAPI_BASE_URL', 'https://api.anthropic.com')
      setEnv('MYAPI_API_KEY', 'test-key')
      setEnv('MYAPI_COMPATIBLE', 'anthropic')

      const provider = createEnvProvider(f)

      expect(() => provider.languageModel('myapi/claude'))
        .toThrow()
    })

    it('should NOT fall back for gemini (no openai-compatible support)', () => {
      const moduleNotFoundError = Object.assign(
        new Error("Cannot find module '@ai-sdk/google'"),
        { code: 'MODULE_NOT_FOUND' },
      )

      const { factories: f } = createMockFactories()
      f.createGemini = () => { throw moduleNotFoundError }

      setEnv('MYAPI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta')
      setEnv('MYAPI_API_KEY', 'test-key')
      setEnv('MYAPI_COMPATIBLE', 'gemini')

      const provider = createEnvProvider(f)

      expect(() => provider.languageModel('myapi/gemini-2.0-flash'))
        .toThrow()
    })

    it('should propagate non-module-not-found errors from openai-compatible fallback', () => {
      const moduleNotFoundError = Object.assign(
        new Error("Cannot find module '@ai-sdk/openai'"),
        { code: 'MODULE_NOT_FOUND' },
      )

      const { factories: f } = createMockFactories()
      f.createOpenAI = () => { throw moduleNotFoundError }
      // The fallback itself throws a non-module-not-found error (e.g. config issue)
      f.createOpenAICompatible = () => { throw new Error('Invalid provider configuration') }

      setEnv('MYAPI_BASE_URL', 'https://api.openai.com/v1')
      setEnv('MYAPI_API_KEY', 'test-key')
      setEnv('MYAPI_COMPATIBLE', 'openai')

      const provider = createEnvProvider(f)

      // Should propagate the original error from createOpenAICompatible, not a generic message
      expect(() => provider.languageModel('myapi/gpt-4o'))
        .toThrow('Invalid provider configuration')
    })

    it('should pass merged headers and fetch through fallback', () => {
      const moduleNotFoundError = Object.assign(
        new Error("Cannot find module '@ai-sdk/openai'"),
        { code: 'MODULE_NOT_FOUND' },
      )

      const { factories: f, mockCreateOpenAICompatible: mockCompat } = createMockFactories()
      f.createOpenAI = () => { throw moduleNotFoundError }

      setEnv('MYAPI_BASE_URL', 'https://api.openai.com/v1')
      setEnv('MYAPI_API_KEY', 'test-key')
      setEnv('MYAPI_COMPATIBLE', 'openai')

      const customFetch = mock() as unknown as typeof globalThis.fetch
      const provider = createEnvProvider(f, {
        defaults: { fetch: customFetch, headers: { 'X-App': 'test' } },
      })
      provider.languageModel('myapi/gpt-4o')

      expect(mockCompat).toHaveBeenCalledWith({
        name: 'myapi',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        headers: { 'X-App': 'test' },
        fetch: customFetch,
      })
    })
  })

  describe('caching', () => {
    it('should only create one provider per config set', () => {
      setEnv('CACHED_BASE_URL', 'https://api.example.com/v1')
      setEnv('CACHED_API_KEY', 'test-key')

      const provider = createEnvProvider(factories)
      provider.languageModel('cached/model-a')
      provider.languageModel('cached/model-b')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledTimes(1)
    })

    it('should create separate providers for different config sets', () => {
      setEnv('A_BASE_URL', 'https://api-a.com')
      setEnv('A_API_KEY', 'key-a')
      setEnv('B_BASE_URL', 'https://api-b.com')
      setEnv('B_API_KEY', 'key-b')

      const provider = createEnvProvider(factories)
      provider.languageModel('a/model')
      provider.languageModel('b/model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledTimes(2)
    })
  })

  describe('model type proxying', () => {
    beforeEach(() => {
      setEnv('TEST_BASE_URL', 'https://api.example.com/v1')
      setEnv('TEST_API_KEY', 'key')
    })

    it('should proxy embeddingModel correctly', () => {
      const provider = createEnvProvider(factories)
      provider.embeddingModel('test/text-embedding-3-small')

      const mockProvider = mockCreateOpenAICompatible.mock.results[0].value as ProviderV3
      expect(mockProvider.embeddingModel).toHaveBeenCalledWith('text-embedding-3-small')
    })

    it('should proxy imageModel correctly', () => {
      const provider = createEnvProvider(factories)
      provider.imageModel('test/dall-e-3')

      const mockProvider = mockCreateOpenAICompatible.mock.results[0].value as ProviderV3
      expect(mockProvider.imageModel).toHaveBeenCalledWith('dall-e-3')
    })

    it('should proxy textEmbeddingModel correctly', () => {
      const provider = createEnvProvider(factories)
      provider.textEmbeddingModel!('test/text-embedding-3-small')

      const mockProvider = mockCreateOpenAICompatible.mock.results[0].value as ProviderV3
      expect(mockProvider.textEmbeddingModel).toHaveBeenCalledWith('text-embedding-3-small')
    })

    it('should proxy transcriptionModel correctly', () => {
      const provider = createEnvProvider(factories)
      provider.transcriptionModel!('test/whisper-1')

      const mockProvider = mockCreateOpenAICompatible.mock.results[0].value as ProviderV3
      expect(mockProvider.transcriptionModel).toHaveBeenCalledWith('whisper-1')
    })

    it('should proxy speechModel correctly', () => {
      const provider = createEnvProvider(factories)
      provider.speechModel!('test/tts-1')

      const mockProvider = mockCreateOpenAICompatible.mock.results[0].value as ProviderV3
      expect(mockProvider.speechModel).toHaveBeenCalledWith('tts-1')
    })

    it('should proxy rerankingModel correctly', () => {
      const provider = createEnvProvider(factories)
      provider.rerankingModel!('test/rerank-1')

      const mockProvider = mockCreateOpenAICompatible.mock.results[0].value as ProviderV3
      expect(mockProvider.rerankingModel).toHaveBeenCalledWith('rerank-1')
    })

    describe('unsupported model types', () => {
      it('should throw NoSuchModelError when provider does not support textEmbeddingModel', () => {
        // Override to return a minimal provider with only languageModel
        mockCreateOpenAICompatible.mockReturnValue({
          specificationVersion: 'v3' as const,
          languageModel: mock(),
        } as unknown as ProviderV3)

        const provider = createEnvProvider(factories)
        expect(() => provider.textEmbeddingModel!('test/model'))
          .toThrow(NoSuchModelError)
      })

      it('should throw NoSuchModelError when provider does not support transcriptionModel', () => {
        mockCreateOpenAICompatible.mockReturnValue({
          specificationVersion: 'v3' as const,
          languageModel: mock(),
        } as unknown as ProviderV3)

        const provider = createEnvProvider(factories)
        expect(() => provider.transcriptionModel!('test/model'))
          .toThrow(NoSuchModelError)
      })

      it('should throw NoSuchModelError when provider does not support speechModel', () => {
        mockCreateOpenAICompatible.mockReturnValue({
          specificationVersion: 'v3' as const,
          languageModel: mock(),
        } as unknown as ProviderV3)

        const provider = createEnvProvider(factories)
        expect(() => provider.speechModel!('test/model'))
          .toThrow(NoSuchModelError)
      })

      it('should throw NoSuchModelError when provider does not support rerankingModel', () => {
        mockCreateOpenAICompatible.mockReturnValue({
          specificationVersion: 'v3' as const,
          languageModel: mock(),
        } as unknown as ProviderV3)

        const provider = createEnvProvider(factories)
        expect(() => provider.rerankingModel!('test/model'))
          .toThrow(NoSuchModelError)
      })
    })
  })
})

describe('envProvider with factories option', () => {
  afterEach(() => {
    clearTestEnv()
  })

  it('should use user-provided openai factory', () => {
    setEnv('OPENAI_API_KEY', 'sk-test')

    const mockFactory = mock((opts: any) =>
      createMockProvider(`user-openai[${opts.baseURL}]`),
    )

    const provider = envProvider({
      factories: { openai: mockFactory },
    })
    provider.languageModel('openai/gpt-4o')

    expect(mockFactory).toHaveBeenCalledWith({
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
    })
  })

  it('should use user-provided anthropic factory', () => {
    setEnv('ANTHROPIC_API_KEY', 'ant-test')

    const mockFactory = mock((opts: any) =>
      createMockProvider(`user-anthropic[${opts.baseURL}]`),
    )

    const provider = envProvider({
      factories: { anthropic: mockFactory },
    })
    provider.languageModel('anthropic/claude-sonnet-4-20250514')

    expect(mockFactory).toHaveBeenCalledWith({
      baseURL: 'https://api.anthropic.com',
      apiKey: 'ant-test',
    })
  })

  it('should use user-provided gemini factory', () => {
    setEnv('GOOGLE_API_KEY', 'google-test')

    const mockFactory = mock((opts: any) =>
      createMockProvider(`user-gemini[${opts.baseURL}]`),
    )

    const provider = envProvider({
      factories: { gemini: mockFactory },
    })
    provider.languageModel('google/gemini-2.0-flash')

    expect(mockFactory).toHaveBeenCalledWith({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      apiKey: 'google-test',
    })
  })

  it('should use user-provided openaiCompatible factory', () => {
    setEnv('MYAPI_BASE_URL', 'https://api.custom.com/v1')
    setEnv('MYAPI_API_KEY', 'custom-key')

    const mockFactory = mock((opts: any) =>
      createMockProvider(`user-compat[${opts.name}]`),
    )

    const provider = envProvider({
      factories: { openaiCompatible: mockFactory },
    })
    provider.languageModel('myapi/some-model')

    expect(mockFactory).toHaveBeenCalledWith({
      name: 'myapi',
      baseURL: 'https://api.custom.com/v1',
      apiKey: 'custom-key',
    })
  })

  it('should fall back to openai-compatible when openai factory is not provided', () => {
    setEnv('OPENAI_API_KEY', 'sk-test')

    // Provide anthropic but not openai — should fall back to openai-compatible
    const provider = envProvider({
      factories: {
        anthropic: mock(() => createMockProvider('anthropic')),
      },
    })

    // Should NOT throw — falls back to built-in openai-compatible
    expect(() => provider.languageModel('openai/gpt-4o')).not.toThrow()
  })

  it('should still throw when anthropic factory is missing (no fallback)', () => {
    setEnv('ANTHROPIC_API_KEY', 'ant-test')

    const provider = envProvider({
      factories: {
        openai: mock(() => createMockProvider('openai')),
      },
    })

    expect(() => provider.languageModel('anthropic/claude-sonnet-4-20250514'))
      .toThrow('No factory provided for "anthropic"')
  })

  it('should still throw when gemini factory is missing (no fallback)', () => {
    setEnv('GOOGLE_API_KEY', 'google-test')

    const provider = envProvider({
      factories: {
        openai: mock(() => createMockProvider('openai')),
      },
    })

    expect(() => provider.languageModel('google/gemini-2.0-flash'))
      .toThrow('No factory provided for "gemini"')
  })

  it('should use openai-compatible without user factory for openaiCompatible', () => {
    setEnv('MYAPI_BASE_URL', 'https://api.custom.com/v1')
    setEnv('MYAPI_API_KEY', 'custom-key')

    // Provide only openai — openaiCompatible should fall back to built-in
    const provider = envProvider({
      factories: {
        openai: mock(() => createMockProvider('openai')),
      },
    })

    // Should NOT throw — built-in openai-compatible is used
    expect(() => provider.languageModel('myapi/some-model')).not.toThrow()
  })

  it('should not throw for missing factory that is never used', () => {
    setEnv('OPENAI_API_KEY', 'sk-test')

    const mockFactory = mock((opts: any) =>
      createMockProvider(`user-openai[${opts.baseURL}]`),
    )

    // Only provide openai, never use anthropic — should not throw
    const provider = envProvider({
      factories: { openai: mockFactory },
    })
    provider.languageModel('openai/gpt-4o')

    expect(mockFactory).toHaveBeenCalledTimes(1)
  })

  it('should pass defaults.fetch through to user-provided factory', () => {
    setEnv('OPENAI_API_KEY', 'sk-test')

    const customFetch = mock() as unknown as typeof globalThis.fetch
    const mockFactory = mock((opts: any) =>
      createMockProvider(`user-openai[${opts.baseURL}]`),
    )

    const provider = envProvider({
      factories: { openai: mockFactory },
      defaults: { fetch: customFetch },
    })
    provider.languageModel('openai/gpt-4o')

    expect(mockFactory).toHaveBeenCalledWith({
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      fetch: customFetch,
    })
  })

  it('should pass merged headers to user-provided factory', () => {
    setEnv('OPENAI_API_KEY', 'sk-test')
    setEnv('OPENAI_HEADERS', '{"X-Custom":"from-env"}')

    const mockFactory = mock((opts: any) =>
      createMockProvider(`user-openai[${opts.baseURL}]`),
    )

    const provider = envProvider({
      factories: { openai: mockFactory },
      defaults: { headers: { 'X-Default': 'default-val' } },
    })
    provider.languageModel('openai/gpt-4o')

    expect(mockFactory).toHaveBeenCalledWith({
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      headers: { 'X-Default': 'default-val', 'X-Custom': 'from-env' },
    })
  })

  it('should work with partial factories and configs option', () => {
    const mockFactory = mock((opts: any) =>
      createMockProvider(`user-openai[${opts.baseURL}]`),
    )

    const provider = envProvider({
      factories: { openai: mockFactory },
      configs: {
        myopenai: {
          preset: 'openai',
          apiKey: 'code-key',
        },
      },
    })
    provider.languageModel('myopenai/gpt-4o')

    expect(mockFactory).toHaveBeenCalledWith({
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'code-key',
    })
  })

  it('should cache providers with user-provided factories', () => {
    setEnv('OPENAI_API_KEY', 'sk-test')

    const mockFactory = mock((opts: any) =>
      createMockProvider(`user-openai[${opts.baseURL}]`),
    )

    const provider = envProvider({
      factories: { openai: mockFactory },
    })
    provider.languageModel('openai/gpt-4o')
    provider.languageModel('openai/gpt-4o-mini')

    // Factory should only be called once (cached)
    expect(mockFactory).toHaveBeenCalledTimes(1)
  })
})

describe('provider v4 compatibility', () => {
  afterEach(() => {
    clearTestEnv()
  })

  describe('v4 internal factories', () => {
    it('should work with V4 mock factories via createEnvProvider', () => {
      const mockCreateOpenAI = mock((opts: any) =>
        createMockV4Provider(`openai-v4[${opts.baseURL}]`),
      )
      const mockCreateAnthropic = mock((opts: any) =>
        createMockV4Provider(`anthropic-v4[${opts.baseURL}]`),
      )
      const mockCreateGemini = mock((opts: any) =>
        createMockV4Provider(`gemini-v4[${opts.baseURL}]`),
      )
      const mockCreateOpenAICompatible = mock((opts: any) =>
        createMockV4Provider(`compat-v4[${opts.name}]`),
      )

      const factories: ProviderFactories = {
        createOpenAI: mockCreateOpenAI,
        createAnthropic: mockCreateAnthropic,
        createGemini: mockCreateGemini,
        createOpenAICompatible: mockCreateOpenAICompatible,
      }

      setEnv('MYAPI_BASE_URL', 'https://api.example.com/v1')
      setEnv('MYAPI_API_KEY', 'test-key')

      const provider = createEnvProvider(factories)
      const model = provider.languageModel('myapi/some-model')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'myapi',
        baseURL: 'https://api.example.com/v1',
        apiKey: 'test-key',
      })
      // Model returned from underlying V4 provider should be passed through
      expect(model).toBeDefined()
      expect((model as any).modelId).toBe('some-model')
    })

    it('should work with V4 openai factory', () => {
      const mockCreateOpenAI = mock((opts: any) =>
        createMockV4Provider(`openai-v4[${opts.baseURL}]`),
      )

      const factories: ProviderFactories = {
        createOpenAI: mockCreateOpenAI,
        createAnthropic: mock(() => createMockV4Provider('anthropic')),
        createGemini: mock(() => createMockV4Provider('gemini')),
        createOpenAICompatible: mock(() => createMockV4Provider('compat')),
      }

      setEnv('MYAPI_BASE_URL', 'https://api.openai.com/v1')
      setEnv('MYAPI_API_KEY', 'test-key')
      setEnv('MYAPI_COMPATIBLE', 'openai')

      const provider = createEnvProvider(factories)
      provider.languageModel('myapi/gpt-4o')

      expect(mockCreateOpenAI).toHaveBeenCalledWith({
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
      })
    })

    it('should work with V4 anthropic factory', () => {
      const mockCreateAnthropic = mock((opts: any) =>
        createMockV4Provider(`anthropic-v4[${opts.baseURL}]`),
      )

      const factories: ProviderFactories = {
        createOpenAI: mock(() => createMockV4Provider('openai')),
        createAnthropic: mockCreateAnthropic,
        createGemini: mock(() => createMockV4Provider('gemini')),
        createOpenAICompatible: mock(() => createMockV4Provider('compat')),
      }

      setEnv('CLAUDE_BASE_URL', 'https://api.anthropic.com')
      setEnv('CLAUDE_API_KEY', 'test-key')
      setEnv('CLAUDE_COMPATIBLE', 'anthropic')

      const provider = createEnvProvider(factories)
      provider.languageModel('claude/claude-sonnet-4-20250514')

      expect(mockCreateAnthropic).toHaveBeenCalledWith({
        baseURL: 'https://api.anthropic.com',
        apiKey: 'test-key',
      })
    })

    it('should work with V4 gemini factory', () => {
      const mockCreateGemini = mock((opts: any) =>
        createMockV4Provider(`gemini-v4[${opts.baseURL}]`),
      )

      const factories: ProviderFactories = {
        createOpenAI: mock(() => createMockV4Provider('openai')),
        createAnthropic: mock(() => createMockV4Provider('anthropic')),
        createGemini: mockCreateGemini,
        createOpenAICompatible: mock(() => createMockV4Provider('compat')),
      }

      setEnv('MYAPI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta')
      setEnv('MYAPI_API_KEY', 'test-key')
      setEnv('MYAPI_COMPATIBLE', 'gemini')

      const provider = createEnvProvider(factories)
      provider.languageModel('myapi/gemini-2.0-flash')

      expect(mockCreateGemini).toHaveBeenCalledWith({
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'test-key',
      })
    })
  })

  describe('v4 user-provided factories via envProvider()', () => {
    it('should accept a V4 openai factory', () => {
      setEnv('OPENAI_API_KEY', 'sk-test')

      const mockFactory = mock((opts: any) =>
        createMockV4Provider(`user-openai-v4[${opts.baseURL}]`),
      )

      const provider = envProvider({
        factories: { openai: mockFactory },
      })
      const model = provider.languageModel('openai/gpt-4o')

      expect(mockFactory).toHaveBeenCalledWith({
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
      })
      expect(model).toBeDefined()
    })

    it('should accept a V4 anthropic factory', () => {
      setEnv('ANTHROPIC_API_KEY', 'ant-test')

      const mockFactory = mock((opts: any) =>
        createMockV4Provider(`user-anthropic-v4[${opts.baseURL}]`),
      )

      const provider = envProvider({
        factories: { anthropic: mockFactory },
      })
      provider.languageModel('anthropic/claude-sonnet-4-20250514')

      expect(mockFactory).toHaveBeenCalledWith({
        baseURL: 'https://api.anthropic.com',
        apiKey: 'ant-test',
      })
    })

    it('should accept a V4 gemini factory', () => {
      setEnv('GOOGLE_API_KEY', 'google-test')

      const mockFactory = mock((opts: any) =>
        createMockV4Provider(`user-gemini-v4[${opts.baseURL}]`),
      )

      const provider = envProvider({
        factories: { gemini: mockFactory },
      })
      provider.languageModel('google/gemini-2.0-flash')

      expect(mockFactory).toHaveBeenCalledWith({
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'google-test',
      })
    })

    it('should accept a V4 openaiCompatible factory', () => {
      setEnv('MYAPI_BASE_URL', 'https://api.custom.com/v1')
      setEnv('MYAPI_API_KEY', 'custom-key')

      const mockFactory = mock((opts: any) =>
        createMockV4Provider(`user-compat-v4[${opts.name}]`),
      )

      const provider = envProvider({
        factories: { openaiCompatible: mockFactory },
      })
      provider.languageModel('myapi/some-model')

      expect(mockFactory).toHaveBeenCalledWith({
        name: 'myapi',
        baseURL: 'https://api.custom.com/v1',
        apiKey: 'custom-key',
      })
    })
  })

  describe('mixed v3 and v4 factories', () => {
    it('should work when openai is V4 and anthropic is V3', () => {
      const v4OpenAI = mock((opts: any) =>
        createMockV4Provider(`openai-v4[${opts.baseURL}]`),
      )
      const v3Anthropic = mock((opts: any) =>
        createMockProvider(`anthropic-v3[${opts.baseURL}]`),
      )

      const factories: ProviderFactories = {
        createOpenAI: v4OpenAI,
        createAnthropic: v3Anthropic,
        createGemini: mock(() => createMockProvider('gemini')),
        createOpenAICompatible: mock(() => createMockProvider('compat')),
      }

      setEnv('OAI_BASE_URL', 'https://api.openai.com/v1')
      setEnv('OAI_API_KEY', 'oai-key')
      setEnv('OAI_COMPATIBLE', 'openai')
      setEnv('ANT_BASE_URL', 'https://api.anthropic.com')
      setEnv('ANT_API_KEY', 'ant-key')
      setEnv('ANT_COMPATIBLE', 'anthropic')

      const provider = createEnvProvider(factories)

      // V4 openai
      const oaiModel = provider.languageModel('oai/gpt-4o')
      expect(oaiModel).toBeDefined()
      expect((oaiModel as any).specificationVersion).toBe('v4')

      // V3 anthropic
      const antModel = provider.languageModel('ant/claude-sonnet-4-20250514')
      expect(antModel).toBeDefined()
      expect((antModel as any).specificationVersion).toBe('v3')
    })

    it('should cache V4 providers correctly', () => {
      const v4Factory = mock((opts: any) =>
        createMockV4Provider(`v4[${opts.baseURL}]`),
      )

      const factories: ProviderFactories = {
        createOpenAI: v4Factory,
        createAnthropic: mock(() => createMockV4Provider('anthropic')),
        createGemini: mock(() => createMockV4Provider('gemini')),
        createOpenAICompatible: mock(() => createMockV4Provider('compat')),
      }

      setEnv('OPENAI_BASE_URL', 'https://api.openai.com/v1')
      setEnv('OPENAI_API_KEY', 'sk-key')
      setEnv('OPENAI_COMPATIBLE', 'openai')

      const provider = createEnvProvider(factories)
      provider.languageModel('openai/gpt-4o')
      provider.languageModel('openai/gpt-4o-mini')

      // Factory called only once — V4 provider is cached
      expect(v4Factory).toHaveBeenCalledTimes(1)
    })

    it('should proxy all model types through V4 provider', () => {
      const v4Provider = createMockV4Provider('v4-test')
      const factories: ProviderFactories = {
        createOpenAI: mock(() => v4Provider),
        createAnthropic: mock(() => createMockV4Provider('anthropic')),
        createGemini: mock(() => createMockV4Provider('gemini')),
        createOpenAICompatible: mock(() => v4Provider),
      }

      setEnv('TEST_BASE_URL', 'https://api.example.com/v1')
      setEnv('TEST_API_KEY', 'key')

      const provider = createEnvProvider(factories)

      provider.languageModel('test/model-a')
      expect(v4Provider.languageModel).toHaveBeenCalledWith('model-a')

      provider.embeddingModel('test/embed-1')
      expect(v4Provider.embeddingModel).toHaveBeenCalledWith('embed-1')

      provider.imageModel('test/dall-e-3')
      expect(v4Provider.imageModel).toHaveBeenCalledWith('dall-e-3')
    })

    it('should pass defaults.fetch and headers through to V4 factory', () => {
      setEnv('OPENAI_API_KEY', 'sk-test')
      setEnv('OPENAI_HEADERS', '{"X-Custom":"from-env"}')

      const mockFactory = mock((opts: any) =>
        createMockV4Provider(`user-v4[${opts.baseURL}]`),
      )

      const customFetch = mock() as unknown as typeof globalThis.fetch
      const provider = envProvider({
        factories: { openai: mockFactory },
        defaults: { fetch: customFetch, headers: { 'X-Default': 'default-val' } },
      })
      provider.languageModel('openai/gpt-4o')

      expect(mockFactory).toHaveBeenCalledWith({
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        headers: { 'X-Default': 'default-val', 'X-Custom': 'from-env' },
        fetch: customFetch,
      })
    })
  })

  describe('textEmbeddingModel fallback for V4 providers', () => {
    it('should fall back to embeddingModel when V4 provider has no textEmbeddingModel', () => {
      // V4 providers don't have textEmbeddingModel (removed in V4 spec)
      const v4Provider = createMockV4Provider('v4-test')
      expect(v4Provider.textEmbeddingModel).toBeUndefined()

      const factories: ProviderFactories = {
        createOpenAI: mock(() => v4Provider),
        createAnthropic: mock(() => createMockV4Provider('anthropic')),
        createGemini: mock(() => createMockV4Provider('gemini')),
        createOpenAICompatible: mock(() => v4Provider),
      }

      setEnv('TEST_BASE_URL', 'https://api.example.com/v1')
      setEnv('TEST_API_KEY', 'key')

      const provider = createEnvProvider(factories)

      // Should NOT throw — falls back to embeddingModel
      const model = provider.textEmbeddingModel!('test/text-embedding-3-small')
      expect(model).toBeDefined()
      expect(v4Provider.embeddingModel).toHaveBeenCalledWith('text-embedding-3-small')
    })

    it('should use textEmbeddingModel when V3 provider has it', () => {
      const v3Provider = createMockProvider('v3-test') as any

      const factories: ProviderFactories = {
        createOpenAI: mock(() => v3Provider),
        createAnthropic: mock(() => createMockProvider('anthropic')),
        createGemini: mock(() => createMockProvider('gemini')),
        createOpenAICompatible: mock(() => v3Provider),
      }

      setEnv('TEST_BASE_URL', 'https://api.example.com/v1')
      setEnv('TEST_API_KEY', 'key')

      const provider = createEnvProvider(factories)
      provider.textEmbeddingModel!('test/text-embedding-3-small')

      // Should call textEmbeddingModel directly on V3 provider
      expect(v3Provider.textEmbeddingModel).toHaveBeenCalledWith('text-embedding-3-small')
      // Should NOT call embeddingModel
      expect(v3Provider.embeddingModel).not.toHaveBeenCalled()
    })

    it('should fall back to embeddingModel via envProvider with V4 user factory', () => {
      setEnv('OPENAI_API_KEY', 'sk-test')

      const mockFactory = mock((opts: any) =>
        createMockV4Provider(`user-v4[${opts.baseURL}]`),
      )

      const provider = envProvider({
        factories: { openai: mockFactory },
      })

      // Should NOT throw even though V4 provider lacks textEmbeddingModel
      const model = provider.textEmbeddingModel!('openai/text-embedding-3-small')
      expect(model).toBeDefined()
    })
  })
})
