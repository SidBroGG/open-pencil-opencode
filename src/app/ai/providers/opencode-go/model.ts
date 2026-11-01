import { randomHex } from '@open-pencil/scene-graph/random'

/**
 * OpenCode Go serves its whole catalog from one base URL and translates a request to the API the
 * model speaks natively. Requests still go to that API, because a translated reasoning stream can
 * lose the signatures a follow-up turn needs.
 */
export const OPENCODE_GO_BASE_URL = 'https://opencode.ai/inference/go'

export const OPENCODE_GO_OPENAI_BASE_URL = `${OPENCODE_GO_BASE_URL}/openai/v1`
export const OPENCODE_GO_ANTHROPIC_BASE_URL = `${OPENCODE_GO_BASE_URL}/anthropic/v1`

/**
 * Go routes and caches by conversation, so it rejects a request without this header as
 * `MissingSessionID`. One ID per chat keeps its routing and prompt cache stable.
 */
export const OPENCODE_GO_SESSION_HEADER = 'x-opencode-session'

export function opencodeGoSessionID(): string {
  return `ses_${randomHex(16)}`
}

export type OpenCodeGoProtocol = 'chat' | 'responses' | 'messages'
/** Claude, Qwen3.7/3.8, and MiniMax M3 are served natively as Anthropic Messages. */
const ANTHROPIC_FAMILY = /^(claude-|qwen3\.[78]-)/

/** GPT, Grok, and Muse Spark are served natively by the Responses API. */
const RESPONSES_FAMILY = /^(gpt-|grok-|muse-spark)/

/**
 * The API a Go model is served by. Every text model also answers through the other APIs, but the
 * translated path may not keep reasoning state, so the native family wins.
 */
export function opencodeGoProtocol(modelID: string): OpenCodeGoProtocol {
  if (modelID === 'minimax-m3' || ANTHROPIC_FAMILY.test(modelID)) return 'messages'
  if (RESPONSES_FAMILY.test(modelID)) return 'responses'
  return 'chat'
}
