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
- 支援 OpenAI、Anthropic、OpenAI Compatible 三種相容模式
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
pnpm add @ai-sdk/openai-compatible # 其他 OpenAI Compatible 提供商
```

## 快速開始

```ts
import { createProviderRegistry, generateText } from 'ai'
import { envProvider } from 'ai-sdk-provider-env'

const registry = createProviderRegistry({
  env: envProvider(),
})

// 使用 preset，只需設定 API_KEY
// OPENAI_PRESET=openai
// OPENAI_API_KEY=sk-xxx
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
| `[MYAI]_BASE_URL` | 無 preset 時必填 | API base URL |
| `[MYAI]_PRESET` | 否 | 內建 preset 名稱（如 `openai`） |
| `[MYAI]_COMPATIBLE` | 否 | 相容模式（預設 `openai-compatible`） |
| `[MYAI]_HEADERS` | 否 | 自訂 HTTP headers（JSON 格式） |

設定 `PRESET` 後，`BASE_URL` 和 `COMPATIBLE` 可省略，會自動套用 preset 的預設值。

**相容模式說明：**

| 值 | 行為 |
|---|---|
| `openai` | 使用 `@ai-sdk/openai` |
| `anthropic` | 使用 `@ai-sdk/anthropic` |
| `openai-compatible` | 使用 `@ai-sdk/openai-compatible`，以設定集名稱作為 provider 名稱（預設） |

## 內建 Presets

| Preset 名稱 | Base URL | 相容模式 |
|---|---|---|
| `openai` | `https://api.openai.com/v1` | `openai` |
| `anthropic` | `https://api.anthropic.com` | `anthropic` |
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
  compatible?: 'openai' | 'anthropic' | 'openai-compatible' // 預設 'openai-compatible'
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
