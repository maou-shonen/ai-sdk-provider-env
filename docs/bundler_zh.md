# Bundler 使用方式

本函式庫使用動態 `require()` 在執行期載入提供商 SDK（`@ai-sdk/openai`、`@ai-sdk/anthropic`、`@ai-sdk/google`）。在 **Node.js / Bun 伺服器**（有 `node_modules`）上開箱即用。如果你使用 **bundler**，請根據部署目標選擇以下方式。

## 方式一：將套件標記為 external（推薦用於 server-side）

如果打包後的輸出在有 `node_modules` 的環境中執行（Docker、傳統伺服器、大多數 serverless 平台），只需將套件標記為 external：

```bash
# Bun
bun build --packages=external

# 或指定特定套件
bun build --external '@ai-sdk/*'
```

esbuild、webpack、Vite 請使用對應的 `external` 配置。

## 方式二：提供明確的 factories（推薦用於單檔 / compile）

如果打包後的輸出必須完全獨立（例如 `bun build --compile`），透過靜態 import 傳入 factory 函式，讓 bundler 能追蹤並打包所需的依賴：

```ts
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { envProvider } from 'ai-sdk-provider-env'

const provider = envProvider({
  factories: {
    openai: createOpenAI,
    anthropic: createAnthropic,
  },
})
```

只需提供你實際使用的 factory。缺少的 factory 會依相容模式不同而有不同行為：

- **`openai`**：在有 `node_modules` 的環境中自動回退至 `@ai-sdk/openai-compatible`（不會報錯）。若使用單檔 / compile 打包，請提供 `openai` 或 `openaiCompatible` factory。
- **`anthropic` / `gemini`**：會在執行期拋出明確的錯誤 — 這些沒有回退方案。
- **`openai-compatible`**：在有 `node_modules` 的環境中自動可用（它是正式依賴）。若使用單檔 / compile 打包，且直接使用此模式，請提供明確的 factory。

### Factory key 對應表

| `compatible` 值 | `factories` key | 套件 | 回退 |
|---|---|---|---|
| `openai` | `openai` | `@ai-sdk/openai` | `openai-compatible` |
| `anthropic` | `anthropic` | `@ai-sdk/anthropic` | 無（報錯） |
| `gemini` | `gemini` | `@ai-sdk/google` | 無（報錯） |
| `openai-compatible` | `openaiCompatible` | `@ai-sdk/openai-compatible` | 內建（透過 `node_modules`） |

### 運作方式

當提供 `factories` 時，函式庫使用 **lazy-strict** 語義：

- 你提供的 factory 會取代內建的動態 `require()`。
- 如果未提供 `openai`，函式庫會透過動態 `require()` 回退至 `@ai-sdk/openai-compatible`。在有 `node_modules` 的環境中可正常運作；若使用單檔打包，請明確提供 `openai` 或 `openaiCompatible` factory。
- 對於 `anthropic` 和 `gemini`，缺少 factory 會拋出描述性錯誤 — 這些提供商沒有 OpenAI 相容的回退方案。
- `openaiCompatible` 如果未提供，會透過動態 `require()` 回退至內建的 `@ai-sdk/openai-compatible`。在有 `node_modules` 的環境中可正常運作；若使用單檔打包，請明確提供 factory。

### 與其他選項搭配使用

`factories` 可與所有其他 `envProvider` 選項搭配（`configs`、`defaults`、`presetAutoDetect` 等）：

```ts
import { createOpenAI } from '@ai-sdk/openai'
import { envProvider } from 'ai-sdk-provider-env'

const provider = envProvider({
  factories: { openai: createOpenAI },
  configs: {
    myapi: {
      preset: 'openai',
      apiKey: process.env.MY_API_KEY!,
    },
  },
  defaults: {
    headers: { 'X-App': 'my-app' },
  },
})
```
