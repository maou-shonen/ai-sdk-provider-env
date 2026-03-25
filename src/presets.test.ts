import type { ProviderFactories } from './env-provider'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { builtinPresets } from '.'
import { createEnvProvider } from './env-provider'

// --- Mock helpers ---

function createMockProvider(providerName: string) {
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
  }
}

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

describe('presets', () => {
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

  describe('built-in preset resolution', () => {
    it('should auto-set baseURL and compatible from built-in preset', () => {
      setEnv('DS_API_KEY', 'deepseek-key')
      setEnv('DS_PRESET', 'deepseek')

      const provider = createEnvProvider(factories)
      provider.languageModel('ds/deepseek-chat')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'ds',
        baseURL: 'https://api.deepseek.com',
        apiKey: 'deepseek-key',
      })
    })

    it('should allow BASE_URL override with preset', () => {
      setEnv('DS_API_KEY', 'deepseek-key')
      setEnv('DS_PRESET', 'deepseek')
      setEnv('DS_BASE_URL', 'https://my-proxy.com/deepseek')

      const provider = createEnvProvider(factories)
      provider.languageModel('ds/deepseek-chat')

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'ds',
        baseURL: 'https://my-proxy.com/deepseek',
        apiKey: 'deepseek-key',
      })
    })

    it('should allow COMPATIBLE override with preset', () => {
      setEnv('DS_API_KEY', 'deepseek-key')
      setEnv('DS_PRESET', 'deepseek')
      setEnv('DS_COMPATIBLE', 'anthropic')

      const provider = createEnvProvider(factories)
      provider.languageModel('ds/deepseek-chat')

      // deepseek preset defaults to openai-compatible, but overridden to anthropic
      expect(mockCreateAnthropic).toHaveBeenCalled()
      expect(mockCreateOpenAI).not.toHaveBeenCalled()
    })

    it('should use anthropic preset correctly', () => {
      setEnv('ANT_API_KEY', 'ant-key')
      setEnv('ANT_PRESET', 'anthropic')

      const provider = createEnvProvider(factories)
      provider.languageModel('ant/claude-sonnet-4-20250514')

      expect(mockCreateAnthropic).toHaveBeenCalledWith({
        baseURL: 'https://api.anthropic.com',
        apiKey: 'ant-key',
      })
    })

    it('should use google preset correctly', () => {
      setEnv('G_API_KEY', 'google-key')
      setEnv('G_PRESET', 'google')

      const provider = createEnvProvider(factories)
      provider.languageModel('g/gemini-2.0-flash')

      expect(mockCreateGemini).toHaveBeenCalledWith({
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'google-key',
      })
    })
  })

  describe('error handling', () => {
    it('should throw on unknown preset and list available ones', () => {
      setEnv('BAD_API_KEY', 'test-key')
      setEnv('BAD_PRESET', 'nonexistent-preset')

      const provider = createEnvProvider(factories)
      expect(() => provider.languageModel('bad/model'))
        .toThrow('Unknown preset')
    })
  })

  describe('builtinPresets data', () => {
    it('should have valid URLs for all preset baseURLs', () => {
      for (const [name, preset] of Object.entries(builtinPresets)) {
        expect(() => new URL(preset.baseURL), `preset "${name}" has invalid baseURL`).not.toThrow()
      }
    })
  })

  describe('nativeRouting preset data', () => {
    it('should have nativeRouting: true for opencode-zen', () => {
      expect(builtinPresets['opencode-zen'].nativeRouting).toBe(true)
    })

    it('should NOT have nativeRouting on other presets', () => {
      const presetsWithNativeRouting = Object.entries(builtinPresets)
        .filter(([name, preset]) => name !== 'opencode-zen' && preset.nativeRouting)
        .map(([name]) => name)
      expect(presetsWithNativeRouting).toHaveLength(0)
    })
  })
})
