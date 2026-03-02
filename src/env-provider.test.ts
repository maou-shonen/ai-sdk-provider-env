import type { ProviderV3 } from '@ai-sdk/provider'
import type { ProviderFactories } from './env-provider'
import { NoSuchModelError } from '@ai-sdk/provider'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { createEnvProvider } from './env-provider'

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
  const mockCreateOpenAICompatible = mock((opts: any) =>
    createMockProvider(`openai-compatible[${opts.name}]`),
  )

  const factories: ProviderFactories = {
    createOpenAI: mockCreateOpenAI,
    createAnthropic: mockCreateAnthropic,
    createOpenAICompatible: mockCreateOpenAICompatible,
  }

  return { factories, mockCreateOpenAI, mockCreateAnthropic, mockCreateOpenAICompatible }
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

describe('envProvider', () => {
  let mockCreateOpenAI: ReturnType<typeof createMockFactories>['mockCreateOpenAI']
  let mockCreateAnthropic: ReturnType<typeof createMockFactories>['mockCreateAnthropic']
  let mockCreateOpenAICompatible: ReturnType<typeof createMockFactories>['mockCreateOpenAICompatible']
  let factories: ProviderFactories

  beforeEach(() => {
    ({ factories, mockCreateOpenAI, mockCreateAnthropic, mockCreateOpenAICompatible } = createMockFactories())
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
