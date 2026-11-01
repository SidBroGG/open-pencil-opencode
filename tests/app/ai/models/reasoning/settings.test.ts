import { describe, expect, test } from 'bun:test'

import { reasoningCallSettings, runtimeReasoningSettings } from '@/app/ai/models/reasoning/settings'
import type { DirectAIModelRuntime } from '@/app/ai/models/runtime'

describe('reasoningCallSettings', () => {
  test('maps thinking levels to the AI SDK reasoning option', () => {
    expect(reasoningCallSettings('anthropic', 'high')).toEqual({ reasoning: 'high' })
    expect(reasoningCallSettings('google', 'off')).toEqual({ reasoning: 'none' })
    expect(reasoningCallSettings('openai-compatible', 'xhigh')).toEqual({ reasoning: 'xhigh' })
    expect(reasoningCallSettings('openrouter', 'low')).toEqual({
      providerOptions: { openrouter: { reasoning: { effort: 'low' } } }
    })
    expect(reasoningCallSettings('anthropic', 'default')).toEqual({})
  })

  test('raises levels below a model’s lowest supported effort', () => {
    expect(reasoningCallSettings('minimax', 'default', 'low')).toEqual({})
    expect(reasoningCallSettings('minimax', 'off', 'low')).toEqual({ reasoning: 'low' })
    expect(reasoningCallSettings('minimax', 'minimal', 'low')).toEqual({ reasoning: 'low' })
    expect(reasoningCallSettings('minimax', 'medium', 'low')).toEqual({ reasoning: 'medium' })
    expect(reasoningCallSettings('openrouter', 'off', 'minimal')).toEqual({
      providerOptions: { openrouter: { reasoning: { effort: 'minimal' } } }
    })
  })

  test('takes the nearest effort a model lists', () => {
    expect(reasoningCallSettings('opencode-go', 'off', undefined, ['low', 'high'])).toEqual({
      reasoning: 'low'
    })
    expect(reasoningCallSettings('opencode-go', 'minimal', undefined, ['low', 'high'])).toEqual({
      reasoning: 'low'
    })
    expect(reasoningCallSettings('opencode-go', 'xhigh', undefined, ['low', 'high'])).toEqual({
      reasoning: 'high'
    })
    expect(
      reasoningCallSettings('opencode-go', 'medium', undefined, ['low', 'medium', 'high'])
    ).toEqual({ reasoning: 'medium' })
    expect(reasoningCallSettings('opencode-go', 'default', undefined, ['low'])).toEqual({})
  })

  test('applies a runtime’s floor to its own thinking level', () => {
    const runtime = {
      role: { connection: { providerID: 'openrouter' }, profile: { thinkingLevel: 'off' } },
      minReasoningEffort: 'low'
    } as Pick<DirectAIModelRuntime, 'role' | 'minReasoningEffort'>
    expect(runtimeReasoningSettings(runtime)).toEqual({
      providerOptions: { openrouter: { reasoning: { effort: 'low' } } }
    })
  })

  test('clamps a runtime’s level to the efforts its model lists', () => {
    const runtime = {
      role: { connection: { providerID: 'opencode-go' }, profile: { thinkingLevel: 'minimal' } },
      efforts: ['low', 'high']
    } as Pick<DirectAIModelRuntime, 'role' | 'minReasoningEffort' | 'efforts'>
    expect(runtimeReasoningSettings(runtime)).toEqual({ reasoning: 'low' })
  })
})
