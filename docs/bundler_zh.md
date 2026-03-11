# Bundler 使用方式

本函式庫使用動態 `require()` 在執行期載入 optional peer dependencies。在 **Node.js / Bun 伺服器**（有 `node_modules`）上開箱即用。如果你使用 **bundler**，請根據部署目標選擇以下方式。

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

只需提供你實際使用的 factory。如果某個設定集解析到一個沒有對應 factory 的相容模式，會在執行期拋出明確的錯誤。

### Factory key 對應表

| `compatible` 值 | `factories` key | 套件 |
|---|---|---|
| `openai` | `openai` | `@ai-sdk/openai` |
| `anthropic` | `anthropic` | `@ai-sdk/anthropic` |
| `gemini` | `gemini` | `@ai-sdk/google` |
| `openai-compatible` | `openaiCompatible` | `@ai-sdk/openai-compatible` |

### 運作方式

當提供 `factories` 時，函式庫使用 **lazy-strict** 語義：

- 你提供的 factory 會取代內建的動態 `require()`。
- 你**沒有提供**的 factory，**只有**在某個設定集實際需要該相容模式時，才會拋出描述性錯誤。
- **不會靜默回退**到動態 `require()` — 一旦選用 `factories`，bundler-safe 保證是嚴格的。

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
