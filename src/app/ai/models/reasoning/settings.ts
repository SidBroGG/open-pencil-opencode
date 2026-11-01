import type { LanguageModelCallOptions } from 'ai'

import { MODEL_REASONING_LEVELS, REASONING_EFFORTS } from '@open-pencil/core/constants'
import type {
  AIProviderID,
  ModelReasoningLevel,
  ReasoningEffort
} from '@open-pencil/core/constants'

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
 * The closest level a model accepts. A model that lists `off` may be turned off; otherwise lower
 * levels rise to its lowest effort. A level between two listed ones takes the nearer, and a tie
 * takes the cheaper lower one.
 */
export function clampThinkingLevel(
  level: ThinkingLevel,
  efforts: readonly ModelReasoningLevel[] | undefined
): ThinkingLevel {
  if (!efforts?.length) return level
  if (level === 'default') return level
  if (efforts.includes(level)) return level

  const target = MODEL_REASONING_LEVELS.indexOf(level)
  let closest = efforts[0]
  let closestDistance = Number.POSITIVE_INFINITY
  for (const effort of efforts) {
    const distance = Math.abs(MODEL_REASONING_LEVELS.indexOf(effort) - target)
    if (distance < closestDistance) {
      closest = effort
      closestDistance = distance
    }
  }
  return closest
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
  efforts?: readonly ModelReasoningLevel[]
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
