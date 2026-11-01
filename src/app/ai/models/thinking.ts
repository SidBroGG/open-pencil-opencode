import { uniq } from 'es-toolkit/array'

import { AI_PROVIDERS } from '@open-pencil/core/constants'
import type { AIProviderID, ReasoningEffort } from '@open-pencil/core/constants'

import { THINKING_LEVELS, type ThinkingLevel } from '@/app/ai/models/types'

const LABEL_KEYS = {
  default: 'thinkingDefault',
  off: 'thinkingOff',
  minimal: 'thinkingMinimal',
  low: 'thinkingLow',
  medium: 'thinkingMedium',
  high: 'thinkingHigh',
  xhigh: 'thinkingExtraHigh'
} as const satisfies Record<ThinkingLevel, string>

export type ThinkingLevelLabels = Record<(typeof LABEL_KEYS)[ThinkingLevel], string>

export function thinkingLevelLabel(level: ThinkingLevel, labels: ThinkingLevelLabels): string {
  return labels[LABEL_KEYS[level]]
}

/**
 * Every level when the model lists none. A model that lists its efforts offers exactly those plus
 * `default`; `off` is left out because the provider raises it to the lowest accepted effort.
 */
export function thinkingLevelOptions(
  labels: ThinkingLevelLabels,
  efforts?: readonly ReasoningEffort[]
) {
  const levels: readonly ThinkingLevel[] = efforts?.length
    ? uniq<ThinkingLevel>(['default', ...efforts])
    : THINKING_LEVELS
  return levels.map((value) => ({ value, label: thinkingLevelLabel(value, labels) }))
}

/** ACP agents choose their own reasoning; API models and Pi accept a level. */
export function supportsThinkingLevel(providerID: string): boolean {
  return !providerID.startsWith('acp:')
}

/**
 * The efforts a curated entry lists, which the composer can filter by without fetching the
 * provider's catalog first.
 */
export function curatedModelEfforts(
  providerID: AIProviderID,
  modelID: string
): readonly ReasoningEffort[] | undefined {
  const provider = AI_PROVIDERS.find((definition) => definition.id === providerID)
  return provider?.models.find((model) => model.id === modelID)?.efforts
}
