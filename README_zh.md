> [For AI agent (llms.txt)](./llms.txt) | [English](./README.md)

# ai-sdk-provider-env

基於環境變數的 [Vercel AI SDK](https://sdk.vercel.ai/) 動態 provider。無需修改程式碼即可切換 AI 提供商與模型。

[![npm version](https://img.shields.io/npm/v/ai-sdk-provider-env)](https://www.npmjs.com/package/ai-sdk-provider-env)
[![license](https://img.shields.io/npm/l/ai-sdk-provider-env)](./LICENSE)

## 快速開始

```bash
pnpm add ai-sdk-provider-env
```

```bash
# .env
OPENAI_API_KEY=sk-xxx
```

```ts
import { generateText } from 'ai'
import { envProvider } from 'ai-sdk-provider-env'

const provider = envProvider()

const { text } = await generateText({
  model: provider.languageModel('openai/gpt-4o'),
  prompt: 'Hello!',
})
```

設定集名稱 `openai` 自動匹配內建 preset，只需設定 API key 即可。

任意[合法的](#環境變數)環境變數前綴即為一組設定集。兩個端點，零行程式碼修改：

```bash
# .env
FAST_BASE_URL=https://fast-api.example.com/v1
FAST_API_KEY=key-fast

SMART_BASE_URL=https://smart-api.example.com/v1
SMART_API_KEY=key-smart
```

```ts
provider.languageModel('fast/llama-3-8b')
provider.languageModel('smart/gpt-4o')
```

## 環境變數

模型 ID 格式：`{設定集}/{模型ID}`。設定集名稱對應大寫的環境變數前綴。

設定集名稱必須符合 `[A-Za-z_][A-Za-z0-9_-]*`——僅允許 ASCII 字母、數字、底線與連字號。**連字號會自動正規化為底線**以產生合法的環境變數名稱：

```bash
# 設定集 "my-api" → 讀取 MY_API_* 環境變數
MY_API_BASE_URL=https://api.example.com/v1
MY_API_API_KEY=sk-xxx
```

```ts
provider.languageModel('my-api/some-model')  // 讀取 MY_API_* 環境變數
provider.languageModel('my_api/some-model')  // 相同的環境變數
```

> 若設定集名稱不符合上述規則（如 Unicode、句點），請改用 [`configs` 選項](./docs/advanced_zh.md#程式碼配置)。

| 環境變數 | 必填 | 說明 |
|---|---|---|
| `{PREFIX}_API_KEY` | 是 | API 金鑰 |
| `{PREFIX}_BASE_URL` | 無 preset 匹配時必填 | API base URL |
| `{PREFIX}_PRESET` | 否 | 內建 preset 名稱（如 `openai`） |
| `{PREFIX}_COMPATIBLE` | 否 | `openai` · `anthropic` · `gemini` · `openai-compatible`（預設） |
| `{PREFIX}_HEADERS` | 否 | 自訂 HTTP headers（JSON 格式） |

設定 `_PRESET` 或[自動偵測](#內建-presets)匹配後，`_BASE_URL` 與 `_COMPATIBLE` 會自動套用 preset 預設值。

### 相容模式

| 值 | SDK | Fallback |
|---|---|---|
| `openai` | `@ai-sdk/openai` | 未安裝時回退至 `@ai-sdk/openai-compatible` |
| `anthropic` | `@ai-sdk/anthropic` | 無 |
| `gemini` | `@ai-sdk/google` | 無 |
| `openai-compatible` | `@ai-sdk/openai-compatible`（預設） | — |

按需安裝 provider SDK：`pnpm add @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google`

## 內建 Presets

設定集名稱與 preset 名稱一致時自動套用，只需設定 `_API_KEY`：

```bash
DEEPSEEK_API_KEY=sk-xxx          # 設定集 "deepseek" 自動匹配 preset
```

```ts
provider.languageModel('deepseek/deepseek-chat')   // 直接可用
```

| Preset | Base URL | 相容模式 |
|---|---|---|
| `openai` | `https://api.openai.com/v1` | `openai` |
| `anthropic` | `https://api.anthropic.com` | `anthropic` |
| `google` | `https://generativelanguage.googleapis.com/v1beta` | `gemini` |
| `deepseek` | `https://api.deepseek.com` | `openai-compatible` |
| `groq` | `https://api.groq.com/openai/v1` | `openai-compatible` |
| `together` | `https://api.together.xyz/v1` | `openai-compatible` |
| `fireworks` | `https://api.fireworks.ai/inference/v1` | `openai-compatible` |
| `mistral` | `https://api.mistral.ai/v1` | `openai-compatible` |
| `moonshot` | `https://api.moonshot.ai/v1` | `openai-compatible` |
| `moonshot-china` | `https://api.moonshot.cn/v1` | `openai-compatible` |
| `perplexity` | `https://api.perplexity.ai` | `openai-compatible` |
| `openrouter` | `https://openrouter.ai/api/v1` | `openai-compatible` |
| `siliconflow` | `https://api.siliconflow.com/v1` | `openai-compatible` |
| `siliconflow-china` | `https://api.siliconflow.cn/v1` | `openai-compatible` |
| `xai` | `https://api.x.ai/v1` | `openai-compatible` |
| `zai` | `https://api.z.ai/api/paas/v4` | `openai-compatible` |
| `zhipu` | `https://open.bigmodel.cn/api/paas/v4` | `openai-compatible` |

停用自動偵測：`envProvider({ presetAutoDetect: false })`。詳見[進階用法](./docs/advanced_zh.md#preset-自動偵測)。

## 文件

- **[API 參考](./docs/api-reference_zh.md)** — `envProvider()` 選項、型別定義、模型 ID 格式
- **[進階用法](./docs/advanced_zh.md)** — 程式碼配置、自訂 fetch/headers、自訂分隔符號、Provider Registry
- **[Bundler 使用方式](./docs/bundler_zh.md)** — 適用於 `bun build`、`vite build` 等打包工具
