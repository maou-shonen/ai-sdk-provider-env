# 進階用法

## Preset 自動偵測

`presetAutoDetect` 預設啟用。當設定集名稱與[內建 preset](../README_zh.md#內建-presets) 名稱完全一致時，會自動套用——無需設定 `_PRESET` 環境變數，只需提供 API 金鑰：

```bash
OPENROUTER_API_KEY=sk-or-xxx
```

```ts
const provider = envProvider()

// 自動偵測 openrouter preset
const model = provider.languageModel('openrouter/some-model')
```

明確設定的 `_PRESET` 和 `_BASE_URL` 環境變數優先於自動偵測。停用方式：

```ts
envProvider({ presetAutoDetect: false })
```

## 原生路由

部分多模型 gateway（如 `opencode-zen`）在同一個 base URL 下提供多個 AI 提供商的協定。`nativeRouting` 功能會自動偵測模型家族，並根據模型 ID 前綴選擇對應的原生 AI SDK。

### 運作原理

當 preset 或 config set 啟用 `nativeRouting` 時：

| 模型前綴 | 路由至 |
|---|---|
| `claude-*` | `@ai-sdk/anthropic` |
| `gemini-*` | `@ai-sdk/google` |
| `gpt-*` | `@ai-sdk/openai` |
| 其他 | 預設 `compatible` 模式 |

### 搭配 opencode-zen 使用

`opencode-zen` preset 預設啟用 `nativeRouting`：

```bash
OPENCODE_ZEN_API_KEY=zen-xxx
```

```ts
// 自動路由至 @ai-sdk/anthropic
provider.languageModel('opencode-zen/claude-sonnet-4-20250514')

// 自動路由至 @ai-sdk/google
provider.languageModel('opencode-zen/gemini-3-flash')
```

### 停用原生路由

停用特定 config set 的原生路由：

```bash
OPENCODE_ZEN_NATIVE_ROUTING=false
```

或在程式碼中設定：

```ts
const provider = envProvider({
  configs: {
    mygateway: {
      baseURL: 'https://my-gateway.com/v1',
      apiKey: process.env.MYGATEWAY_API_KEY!,
      nativeRouting: false,
    },
  },
})
```

### 已知限制

- 僅匹配 `claude-*`、`gemini-*`、`gpt-*` 前綴。
- `o1-*`、`o3-*`、`chatgpt-*` 不會自動路由。請明確設定 `{PREFIX}_COMPATIBLE=openai`。
- 本版本不支援 `nativeRouting` 物件形式（逐路由覆蓋）。

## Provider Fallback

當使用 `compatible: 'openai'` 且未安裝 `@ai-sdk/openai` 時，provider 會自動回退至 `@ai-sdk/openai-compatible`（需執行期可解析）。單檔打包請參閱 [Bundler 使用方式](./bundler_zh.md)。

Anthropic 和 Google 沒有 fallback——必須安裝對應 SDK。如需完整功能（語音、轉錄、provider 專屬工具），請安裝官方 SDK。

## 程式碼配置

透過 `configs` 直接在程式碼中提供配置，優先於環境變數：

```ts
const provider = envProvider({
  configs: {
    openai: {
      baseURL: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY!,
      compatible: 'openai',
    },
    claude: {
      baseURL: 'https://api.anthropic.com',
      apiKey: process.env.ANTHROPIC_API_KEY!,
      compatible: 'anthropic',
    },
    deepseek: {
      preset: 'deepseek',
      apiKey: process.env.DEEPSEEK_API_KEY!,
    },
  },
})

const model = provider.languageModel('openai/gpt-4o')
```

## 自訂分隔符號

若環境變數命名慣例使用雙底線，可調整 `separator`：

```ts
const provider = envProvider({ separator: '__' })

// 對應環境變數：OPENAI__BASE_URL、OPENAI__API_KEY、OPENAI__PRESET、OPENAI__COMPATIBLE
```

分隔符號僅允許 ASCII 字母、數字或底線（`[A-Za-z0-9_]+`）。包含 `-` 或空格等字元會被拒絕，因為這些字元會產生不符合 POSIX shell 規範的環境變數名稱。

## 設定集命名規則

設定集名稱（模型 ID 中 `/` 前的部分）在透過環境變數解析時，必須符合 `[A-Za-z_][A-Za-z0-9_-]*`。連字號會自動正規化為底線：

```ts
// 兩者讀取相同的環境變數：MY_API_API_KEY、MY_API_BASE_URL 等
provider.languageModel('my-api/model')
provider.languageModel('my_api/model')
```

不符合規則的名稱（Unicode、句點、數字開頭等）會拋出含操作建議的錯誤。使用 [`configs`](#程式碼配置) 可繞過所有命名限制：

```ts
const provider = envProvider({
  configs: {
    'my.special" provider': {
      baseURL: 'https://api.example.com/v1',
      apiKey: 'key',
    },
  },
})
```

## 自訂 Fetch

傳入自訂 fetch 實作，套用到所有 provider：

```ts
const provider = envProvider({ defaults: { fetch: myCustomFetch } })
```

## Headers

### 預設 Headers

設定套用到所有 provider 的 HTTP headers。設定集 headers 會覆蓋同名 key 的預設值：

```ts
const provider = envProvider({
  defaults: {
    headers: { 'X-App-Name': 'my-app', 'X-Request-Source': 'server' },
  },
})
```

### 環境變數設定 Headers

透過 `_HEADERS` 環境變數為特定設定集設定自訂 HTTP headers（JSON 格式）：

```bash
OPENAI_HEADERS={"X-Custom":"value","X-Request-Source":"my-app"}
```

與 `defaults.headers` 合併時，設定集 headers 優先於預設值。

## 搭配 `createProviderRegistry`

`envProvider()` 實作 `ProviderV3` 介面，可直接傳入 `createProviderRegistry`：

```ts
import { createProviderRegistry, generateText } from 'ai'
import { envProvider } from 'ai-sdk-provider-env'

const registry = createProviderRegistry({
  env: envProvider(),
})

const model = registry.languageModel('env:openai/gpt-4o')
const embedder = registry.embeddingModel('env:openai/text-embedding-3-small')
const imageModel = registry.imageModel('env:openai/dall-e-3')
```

Registry 中的模型 ID 格式為 `{registryKey}:{設定集}/{模型ID}`。以上設定中，`env:openai/gpt-4o` 代表設定集 `openai`、模型 `gpt-4o`。

也可以同時掛載多個 provider：

```ts
import { createOpenAI } from '@ai-sdk/openai'

const registry = createProviderRegistry({
  env: envProvider(),
  openai: createOpenAI({ apiKey: process.env.OPENAI_API_KEY }),
})
```
