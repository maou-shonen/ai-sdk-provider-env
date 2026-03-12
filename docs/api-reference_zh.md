# API 參考

## `envProvider(options?)`

回傳一個 `ProviderV3` 實例。

```ts
import { envProvider } from 'ai-sdk-provider-env'

const provider = envProvider(options)
```

### 選項（`EnvProviderOptions`）

| 選項 | 型別 | 預設值 | 說明 |
|---|---|---|---|
| `separator` | `string` | `'_'` | 環境變數前綴與變數名稱之間的分隔符號 |
| `configs` | `Record<string, ConfigSetEntry>` | `undefined` | 程式碼中指定的設定集配置，優先於環境變數 |
| `defaults` | `EnvProviderDefaults` | `undefined` | 全域預設值，套用到所有 provider（可被個別設定集覆蓋） |
| `presetAutoDetect` | `boolean` | `true` | 設定集名稱與內建 preset 相符時自動套用。設為 `false` 則需明確設定 `_PRESET` |
| `factories` | `EnvProviderFactories` | `undefined` | 使用者提供的 factory 函式，用於 [bundler 安全模式](./bundler_zh.md) |

### `EnvProviderDefaults`

| 選項 | 型別 | 預設值 | 說明 |
|---|---|---|---|
| `fetch` | `typeof globalThis.fetch` | `undefined` | 自訂 fetch 實作，傳遞給所有建立的 provider |
| `headers` | `Record<string, string>` | `undefined` | 預設 HTTP headers，套用到所有 provider（可被設定集 headers 覆蓋） |

### `ConfigSetEntry`

```ts
interface ConfigSetEntry {
  apiKey: string
  preset?: string
  baseURL?: string
  compatible?: 'openai' | 'anthropic' | 'gemini' | 'openai-compatible' // 預設 'openai-compatible'
  headers?: Record<string, string>
}
```

### 模型 ID 格式

```
{設定集}/{模型ID}
```

第一個 `/` 分隔設定集名稱與模型 ID，之後的內容原封不動傳遞給底層 provider。

範例：`openai/gpt-4o`、`anthropic/claude-sonnet-4-20250514`、`myapi/some-model`。
