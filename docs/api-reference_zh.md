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
| `separator` | `string` | `'_'` | 環境變數前綴與變數名稱之間的分隔符號。必須符合 `[A-Za-z0-9_]+`（shell-safe）。 |
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
  compatible?: 'openai' | 'anthropic' | 'gemini' | 'openai-compatible' // 繼承 preset 值，或 'openai-compatible'
  headers?: Record<string, string>
  nativeRouting?: boolean // 依模型前綴自動路由至原生 SDK（claude-* → anthropic、gemini-* → google、gpt-* → openai）
}
```

### `PresetConfig`

內建 preset 與 `ConfigSetEntry` 欄位相同（不含 `apiKey`）。`nativeRouting` 欄位可用於 preset：

```ts
interface PresetConfig {
  baseURL: string
  compatible?: 'openai' | 'anthropic' | 'gemini' | 'openai-compatible'
  nativeRouting?: boolean
}
```

`opencode-zen` preset 預設啟用 `nativeRouting: true`。可透過 `{PREFIX}_NATIVE_ROUTING=false` 覆蓋。

### 模型 ID 格式

```text
{設定集}/{模型ID}
```

第一個 `/` 分隔設定集名稱與模型 ID，之後的內容原封不動傳遞給底層 provider。

**設定集命名規則**（環境變數解析路徑）：
- 必須符合 `[A-Za-z_][A-Za-z0-9_-]*`——僅允許 ASCII 字母、數字、底線、連字號
- 連字號（`-`）會正規化為底線（`_`）以查找環境變數：`my-api` → `MY_API_*`
- `my-api` 與 `my_api` 解析到相同的環境變數
- 不符合規則的名稱需使用 `configs` 選項

範例：`openai/gpt-4o`、`my-api/some-model`、`anthropic/claude-sonnet-4-20250514`。
