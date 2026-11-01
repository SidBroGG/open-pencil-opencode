import {
  createAnthropicCompatibleAdapter,
  createOpenAICompatibleAdapter
} from '@/app/ai/providers/compatible'
import type { ModelProviderAdapter } from '@/app/ai/providers/types'

import {
  OPENCODE_GO_ANTHROPIC_BASE_URL,
  OPENCODE_GO_OPENAI_BASE_URL,
  OPENCODE_GO_SESSION_HEADER,
  opencodeGoProtocol,
  opencodeGoSessionID
} from './model'

/**
 * One key and one base URL; the model decides which of Go's APIs answers it, and each model
 * instance carries the session its conversation is routed and cached by.
 */
export const opencodeGoAdapter: ModelProviderAdapter = {
  create(config, runtime) {
    const modelID = config.customModelID.trim() || config.modelID
    const protocol = opencodeGoProtocol(modelID)
    const headers = { [OPENCODE_GO_SESSION_HEADER]: opencodeGoSessionID() }

    if (protocol === 'messages') {
      return createAnthropicCompatibleAdapter({
        baseURL: OPENCODE_GO_ANTHROPIC_BASE_URL,
        headers
      }).create(config, runtime)
    }
    const openai = createOpenAICompatibleAdapter({
      baseURL: OPENCODE_GO_OPENAI_BASE_URL,
      mode: protocol,
      headers
    })
    return openai.create(config, runtime)
  }
}
