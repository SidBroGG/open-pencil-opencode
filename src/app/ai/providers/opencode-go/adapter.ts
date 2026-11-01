import {
  createAnthropicCompatibleAdapter,
  createOpenAICompatibleAdapter
} from '@/app/ai/providers/compatible'
import type { ModelProviderAdapter } from '@/app/ai/providers/types'

import {
  OPENCODE_GO_ANTHROPIC_BASE_URL,
  OPENCODE_GO_OPENAI_BASE_URL,
  opencodeGoProtocol
} from './model'

const chat = createOpenAICompatibleAdapter({
  baseURL: OPENCODE_GO_OPENAI_BASE_URL,
  mode: 'chat'
})
const responses = createOpenAICompatibleAdapter({
  baseURL: OPENCODE_GO_OPENAI_BASE_URL,
  mode: 'responses'
})
const messages = createAnthropicCompatibleAdapter({ baseURL: OPENCODE_GO_ANTHROPIC_BASE_URL })

/** One key and one base URL; the model decides which of Go's APIs answers it. */
export const opencodeGoAdapter: ModelProviderAdapter = {
  create(config, runtime) {
    const protocol = opencodeGoProtocol(config.customModelID.trim() || config.modelID)
    if (protocol === 'messages') return messages.create(config, runtime)
    if (protocol === 'responses') return responses.create(config, runtime)
    return chat.create(config, runtime)
  }
}
