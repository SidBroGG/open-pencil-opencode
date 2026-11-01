import { uniq } from 'es-toolkit/array'

import { AI_PROVIDERS, MODEL_REASONING_LEVELS } from '@open-pencil/core/constants'
import type { AIProviderID, ModelReasoningLevel } from '@open-pencil/core/constants'

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
 * `default`, lowest first, so a catalog's own ordering never reaches the picker.
 */
export function thinkingLevelOptions(
  labels: ThinkingLevelLabels,
  efforts?: readonly ModelReasoningLevel[]
) {
  if (!efforts?.length) return THINKING_LEVELS.map((value) => ({ value, label: thinkingLevelLabel(value, labels) }))
  const offered: ThinkingLevel[] = MODEL_REASONING_LEVELS.filter((level) => efforts.includes(level))
  return uniq<ThinkingLevel>(['default', ...offered]).map((value) => ({
    value,
    label: thinkingLevelLabel(value, labels)
  }))
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
): readonly ModelReasoningLevel[] | undefined {
  const provider = AI_PROVIDERS.find((definition) => definition.id === providerID)
  return provider?.models.find((model) => model.id === modelID)?.efforts
}
