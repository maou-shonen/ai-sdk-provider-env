> [English](./README.md)

# ai-sdk-provider-env

動態、基於環境變數的 [Vercel AI SDK](https://sdk.vercel.ai/) provider。透過命名慣例在執行期自動解析 AI 提供商配置，無需修改程式碼即可切換模型。

[![npm version](https://img.shields.io/npm/v/ai-sdk-provider-env)](https://www.npmjs.com/package/ai-sdk-provider-env)
[![license](https://img.shields.io/npm/l/ai-sdk-provider-env)](./LICENSE)

## 開發動機

在 Vercel AI SDK 中使用多個 AI 提供商，意味著要逐一 import 各家 SDK、設定 API Key 和 Base URL、串接到 registry——每個提供商、每個專案都要重複一次。切換提供商就得改程式碼。

`ai-sdk-provider-env` 消除了這些重複工作。透過環境變數定義提供商配置，在執行期動態解析。新增提供商只需設定環境變數，切換模型只需改一個字串——完全不用動程式碼。

## 特色

- 透過環境變數慣例（如 `OPENAI_BASE_URL`）自動解析提供商配置，無需手動初始化每個 provider
- 內建多個常見提供商的 preset，只需設定 API Key 即可使用
- 支援 OpenAI、Anthropic、Google Gemini、OpenAI Compatible 四種相容模式（OpenAI 模式在未安裝 SDK 時會自動 fallback 到 openai-compatible）
- 實作 `ProviderV3` 介面，可直接接入 `createProviderRegistry`
- Provider 實例自動快取，避免重複初始化
- 支援自訂 fetch、環境變數設定 headers、自訂分隔符號、程式碼指定配置

## 安裝

```bash
pnpm add ai-sdk-provider-env
```

按需安裝 provider SDK：

```bash
pnpm add @ai-sdk/openai            # OpenAI
pnpm add @ai-sdk/anthropic         # Anthropic
pnpm add @ai-sdk/google            # Google AI Studio (Gemini)
```

`@ai-sdk/openai-compatible` 已作為相依套件包含在內，會在需要時自動使用。

## 快速開始

```ts
import { createProviderRegistry, generateText } from 'ai'
import { envProvider } from 'ai-sdk-provider-env'

const registry = createProviderRegistry({
  env: envProvider(),
})

// 使用 preset，只需設定 API_KEY
// OPENAI_API_KEY=sk-xxx（OPENAI_PRESET=openai 可省略——自動偵測）
const model = registry.languageModel('env:openai/gpt-4o')

const { text } = await generateText({ model, prompt: 'Hello!' })
```

任意環境變數前綴就是一個設定集。兩個端點？兩組前綴，零行程式碼修改：

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
  prompt: '寫一個故事',
})

const review = await generateText({
  model: registry.languageModel('env:smart/gpt-4o'),
  prompt: `評論這篇文章：${draft.text}`,
})
```

## 環境變數慣例

模型 ID 格式為 `{設定集}/{模型ID}`，設定集名稱對應環境變數前綴（自動轉大寫）。

以預設分隔符號 `_` 為例，各設定集對應以下環境變數（`[MYAI]` = 你的設定集名稱，自動轉大寫）：

| 環境變數 | 必填 | 說明 |
|---|---|---|
| `[MYAI]_API_KEY` | 是 | API 金鑰 |
| `[MYAI]_BASE_URL` | 無 preset 且未自動偵測時必填 | API base URL |
| `[MYAI]_PRESET` | 否 | 內建 preset 名稱（如 `openai`） |
| `[MYAI]_COMPATIBLE` | 否 | 相容模式（預設 `openai-compatible`） |
| `[MYAI]_HEADERS` | 否 | 自訂 HTTP headers（JSON 格式） |

設定 `PRESET` 後，`BASE_URL` 和 `COMPATIBLE` 可省略，會自動套用 preset 的預設值。

**相容模式說明：**

| 值 | 行為 |
|---|---|
| `openai` | 使用 `@ai-sdk/openai`。若未安裝則自動 fallback 到 `@ai-sdk/openai-compatible` |
| `anthropic` | 使用 `@ai-sdk/anthropic` |
| `gemini` | 使用 `@ai-sdk/google` |
| `openai-compatible` | 使用 `@ai-sdk/openai-compatible`，以設定集名稱作為 provider 名稱（預設） |

## Provider Fallback

當使用 `compatible: 'openai'` 且未安裝 `@ai-sdk/openai` 時，provider 會自動 fallback 到 `@ai-sdk/openai-compatible`。這讓基本的文字生成可以在不安裝官方 SDK 的情況下運作。

Anthropic 和 Google 沒有 fallback 機制。要使用它們的相容模式，必須安裝對應的 SDK。

如需完整功能（如語音、轉錄、provider 專屬工具），請安裝官方 SDK（`@ai-sdk/openai`、`@ai-sdk/anthropic` 或 `@ai-sdk/google`）。

## 內建 Presets

| Preset 名稱 | Base URL | 相容模式 |
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

## Preset 自動偵測

`presetAutoDetect` 預設啟用。當設定集名稱與內建 preset 名稱完全一致時，會自動套用對應 preset——無需設定 `_PRESET` 環境變數，只需提供 API 金鑰：

```bash
# 只需設定 OPENROUTER_API_KEY
OPENROUTER_API_KEY=sk-or-xxx
```

```ts
const provider = envProvider()

// 自動偵測 openrouter preset
const model = provider.languageModel('openrouter/some-model')
```

明確設定的 `_PRESET` 和 `_BASE_URL` 環境變數優先於自動偵測。若要停用此行為：

```ts
envProvider({ presetAutoDetect: false })
```

## API 參考

### `envProvider(options?)`

回傳一個 `ProviderV3` 實例。

```ts
import { envProvider } from 'ai-sdk-provider-env'

const provider = envProvider(options)
```

**參數** (`EnvProviderOptions`)：

| 選項 | 型別 | 預設值 | 說明 |
|---|---|---|---|
| `separator` | `string` | `'_'` | 環境變數前綴與變數名稱之間的分隔符號 |
| `configs` | `Record<string, ConfigSetEntry>` | `undefined` | 在程式碼中明確指定設定集配置，優先於環境變數 |
| `defaults` | `EnvProviderDefaults` | `undefined` | 全域預設值，套用到所有 provider（可被個別設定集覆蓋） |
| `presetAutoDetect` | `boolean` | `true` | 設定集名稱與內建 preset 相符時自動套用。設為 `false` 則需明確設定 `_PRESET` 環境變數。 |
| `factories` | `EnvProviderFactories` | `undefined` | 使用者提供的 factory 函式，用於 [bundler 安全模式](#bundler-使用方式)。 |

**`EnvProviderDefaults`：**

| 選項 | 型別 | 預設值 | 說明 |
|---|---|---|---|
| `fetch` | `typeof globalThis.fetch` | `undefined` | 自訂 `fetch` 實作，傳遞給所有建立的 provider |
| `headers` | `Record<string, string>` | `undefined` | 預設 HTTP headers，套用到所有 provider（可被設定集的 headers 覆蓋） |

**`ConfigSetEntry`：**

```ts
interface ConfigSetEntry {
  apiKey: string
  preset?: string
  baseURL?: string
  compatible?: 'openai' | 'anthropic' | 'gemini' | 'openai-compatible' // 預設 'openai-compatible'
  headers?: Record<string, string>
}
```

**模型 ID 格式：**

```
{設定集}/{模型ID}
```

範例：`openai/gpt-4o`、`anthropic/claude-sonnet-4-20250514`、`myapi/some-model`。

## 進階用法

### 自訂分隔符號

若環境變數命名慣例使用雙底線，可調整 `separator`：

```ts
const provider = envProvider({ separator: '__' })

// 對應環境變數變為：OPENAI__BASE_URL、OPENAI__API_KEY、OPENAI__PRESET、OPENAI__COMPATIBLE
```

### 程式碼指定配置

透過 `configs` 直接在程式碼中提供配置，優先於環境變數：

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

### 自訂 fetch

傳入自訂 `fetch` 實作，會套用到所有建立的 provider：

```ts
const provider = envProvider({ defaults: { fetch: myCustomFetch } })
```

### 預設 Headers

設定套用到所有 provider 的 HTTP headers。個別設定集的 headers（環境變數或程式碼配置）會覆蓋同名 key 的預設值：

```ts
const provider = envProvider({
  defaults: {
    headers: { 'X-App-Name': 'my-app', 'X-Request-Source': 'server' },
  },
})
```

### 自訂 Headers（環境變數）

透過環境變數為特定設定集設定自訂 HTTP headers，使用 JSON 格式：

```bash
OPENAI_HEADERS={"X-Custom-Header":"value","X-Another":"foo"}
```

與 `defaults.headers` 合併使用時，設定集的 headers 優先於預設值（同名 key 以設定集為準）。

### 搭配 `createProviderRegistry` 使用

`envProvider()` 實作 `ProviderV3` 介面，可直接傳入 `createProviderRegistry`：

```ts
import { createProviderRegistry, generateText } from 'ai'
import { envProvider } from 'ai-sdk-provider-env'

const registry = createProviderRegistry({
  env: envProvider(),
})

// 語言模型
const model = registry.languageModel('env:openai/gpt-4o')

// Embedding 模型
const embedder = registry.embeddingModel('env:openai/text-embedding-3-small')

// 圖像模型
const imageModel = registry.imageModel('env:openai/dall-e-3')

const { text } = await generateText({
  model,
  prompt: '用繁體中文介紹台灣',
})
```

Registry 中的模型 ID 格式為 `{registryKey}:{設定集}/{模型ID}`。以上設定中，`env:openai/gpt-4o` 代表設定集 `openai`、模型 `gpt-4o`。

也可以同時掛載多個 provider 混合使用：

```ts
import { createOpenAI } from '@ai-sdk/openai'

const registry = createProviderRegistry({
  env: envProvider(),
  openai: createOpenAI({ apiKey: process.env.OPENAI_API_KEY }),
})
```

## Bundler 使用方式

不使用 bundler 時開箱即用。如果你有打包需求，兩種方式：

**方式 A** — 將套件標記為 external（server-side，有 `node_modules`）：

```bash
bun build --packages=external
```

**方式 B** — 提供明確的 factories（單檔 / `bun build --compile`）：

```ts
import { createOpenAI } from '@ai-sdk/openai'
import { envProvider } from 'ai-sdk-provider-env'

const provider = envProvider({
  factories: { openai: createOpenAI },
})
```

完整指南（factory key 對應表、lazy-strict 行為、與其他選項搭配使用）詳見 **[Bundler 使用指南](./docs/bundler_zh.md)**。
