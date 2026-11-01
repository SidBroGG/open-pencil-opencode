import type { LanguageModelCallOptions } from 'ai'

import { REASONING_EFFORTS } from '@open-pencil/core/constants'
import type { AIProviderID, ReasoningEffort } from '@open-pencil/core/constants'

import type { DirectAIModelRuntime } from '@/app/ai/models/runtime'
import type { ThinkingLevel } from '@/app/ai/models/types'

type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue }
export type AIProviderOptions = Record<string, { [key: string]: JSONValue }>

export type ReasoningCallSettings = {
  reasoning?: LanguageModelCallOptions['reasoning']
  providerOptions?: AIProviderOptions
}

function raisedLevel(level: ThinkingLevel, minEffort: ReasoningEffort | undefined) {
  if (!minEffort || level === 'default') return level
  if (level === 'off') return minEffort
  return REASONING_EFFORTS.indexOf(level) < REASONING_EFFORTS.indexOf(minEffort) ? minEffort : level
}

/**
 * The closest level a model accepts: Off and lower levels use its lowest effort, higher ones its
 * highest. A model whose full list is unknown keeps whatever was chosen.
 */
export function clampThinkingLevel(
  level: ThinkingLevel,
  efforts: readonly ReasoningEffort[] | undefined
): ThinkingLevel {
  if (!efforts?.length || level === 'default') return level
  const lowest = efforts[0]
  const highest = efforts[efforts.length - 1]
  if (level === 'off') return lowest
  const index = REASONING_EFFORTS.indexOf(level)
  if (index < REASONING_EFFORTS.indexOf(lowest)) return lowest
  if (index > REASONING_EFFORTS.indexOf(highest)) return highest
  return efforts.includes(level) ? level : lowest
}

/**
 * AI SDK providers map the standard `reasoning` level to their own thinking options.
 * OpenRouter's provider ignores it, so it receives the equivalent provider option.
 * Models that always reason raise lower levels to the lowest effort they accept; a model that
 * lists its whole set of efforts takes the nearest one instead.
 */
export function reasoningCallSettings(
  providerID: AIProviderID,
  level: ThinkingLevel,
  minEffort?: ReasoningEffort,
  efforts?: readonly ReasoningEffort[]
): ReasoningCallSettings {
  const effective = efforts?.length
    ? clampThinkingLevel(level, efforts)
    : raisedLevel(level, minEffort)
  if (effective === 'default') return {}
  const reasoning = effective === 'off' ? 'none' : effective
  if (providerID === 'openrouter') {
    return { providerOptions: { openrouter: { reasoning: { effort: reasoning } } } }
  }
  return { reasoning }
}

/** Reasoning settings for a runtime's own thinking level. */
export function runtimeReasoningSettings(
  runtime: Pick<DirectAIModelRuntime, 'role' | 'minReasoningEffort' | 'efforts'>
): ReasoningCallSettings {
  return reasoningCallSettings(
    runtime.role.connection.providerID,
    runtime.role.profile.thinkingLevel,
    runtime.minReasoningEffort,
    runtime.efforts
  )
}
