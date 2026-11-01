import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'

import { IS_TAURI } from '@open-pencil/core/constants'

import type { ModelConfig, ModelProviderAdapter } from '@/app/ai/providers/types'

// Anthropic omits CORS headers unless the caller opts in, so browser requests fail with an
// opaque "failed to fetch". The desktop build goes through tauriFetch and is not subject to CORS.
const BROWSER_ACCESS_HEADERS = { 'anthropic-dangerous-direct-browser-access': 'true' }

export type CompatibleEndpoint = string | ((config: ModelConfig) => string)

type OpenAICompatibleOptions = {
  baseURL?: CompatibleEndpoint
  /** `configurable` follows the profile's API type, so a server offers both endpoints. */
  mode?: 'default' | 'chat' | 'responses' | 'configurable'
  /** Sent with every request, for a provider that asks for a routing header. */
  headers?: Record<string, string>
}

type AnthropicCompatibleOptions = {
  baseURL?: CompatibleEndpoint
  headers?: Record<string, string>
}

function resolveEndpoint(endpoint: CompatibleEndpoint | undefined, config: ModelConfig) {
  return typeof endpoint === 'function' ? endpoint(config) : endpoint
}

export function createOpenAICompatibleAdapter(
  options: OpenAICompatibleOptions = {}
): ModelProviderAdapter {
  return {
    create(config, runtime) {
      const provider = createOpenAI({
        apiKey: config.apiKey,
        baseURL: resolveEndpoint(options.baseURL, config),
        headers: options.headers,
        fetch: runtime.fetch
      })
      const modelID = config.customModelID.trim() || config.modelID
      if (options.mode === 'chat') return provider.chat(modelID)
      if (options.mode === 'responses') return provider.responses(modelID)
      if (options.mode === 'configurable') {
        return config.customAPIType === 'responses'
          ? provider.responses(modelID)
          : provider.chat(modelID)
      }
      return provider(modelID)
    }
  }
}

export function createAnthropicCompatibleAdapter(
  options: AnthropicCompatibleOptions = {}
): ModelProviderAdapter {
  return {
    create(config, runtime) {
      const headers: Record<string, string> = { ...options.headers }
      if (!IS_TAURI) Object.assign(headers, BROWSER_ACCESS_HEADERS)
      const provider = createAnthropic({
        apiKey: config.apiKey,
        baseURL: resolveEndpoint(options.baseURL, config),
        headers,
        fetch: runtime.fetch
      })
      return provider(config.customModelID.trim() || config.modelID)
    }
  }
}
