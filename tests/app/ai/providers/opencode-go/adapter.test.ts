import { describe, expect, test } from 'bun:test'

import type { LanguageModel } from 'ai'

import type { ReasoningEffort } from '@open-pencil/core/constants'

import { reasoningCallSettings } from '@/app/ai/models/reasoning/settings'
import type { ThinkingLevel } from '@/app/ai/models/types'
import { opencodeGoProtocol } from '@/app/ai/providers/opencode-go/model'
import { modelProviderAdapter } from '@/app/ai/providers/registry'
import type { ModelConfig } from '@/app/ai/providers/types'
import type { FetchFunction } from '@/app/http/types'

function languageModelInstance(model: LanguageModel): Exclude<LanguageModel, string> {
  if (typeof model === 'string') throw new Error(`Expected a model instance, got ${model}`)
  return model
}

interface CapturedRequest {
  url: string
  body: unknown
  headers: Record<string, string>
}

async function capturedRequest(
  modelID: string,
  level: ThinkingLevel = 'default',
  efforts?: readonly ReasoningEffort[]
): Promise<CapturedRequest> {
  let url = ''
  let body = ''
  let headers: Record<string, string> = {}
  const fetchSpy: FetchFunction = async (input, init) => {
    url = String(input)
    body = String(init?.body)
    headers = Object.fromEntries(new Headers(init?.headers).entries())
    throw new Error('stop')
  }
  const config: ModelConfig = {
    providerID: 'opencode-go',
    apiKey: 'oc_sk-test',
    modelID,
    customModelID: '',
    customBaseURL: '',
    customAPIType: 'completions'
  }

  const model = languageModelInstance(
    modelProviderAdapter('opencode-go').create(config, { fetch: fetchSpy })
  )
  await Promise.resolve(
    model.doGenerate({
      ...reasoningCallSettings('opencode-go', level, undefined, efforts),
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }]
    })
  ).catch(() => undefined)

  const parsed: unknown = JSON.parse(body)
  return { url, body: parsed, headers }
}

describe('opencodeGoProtocol', () => {
  test('keeps each model family on the API it is served by natively', () => {
    expect(opencodeGoProtocol('gpt-6-luna')).toBe('responses')
    expect(opencodeGoProtocol('grok-4.7')).toBe('responses')
    expect(opencodeGoProtocol('claude-haiku-5-5')).toBe('messages')
    expect(opencodeGoProtocol('qwen3.8-max')).toBe('messages')
    expect(opencodeGoProtocol('minimax-m3')).toBe('messages')
    expect(opencodeGoProtocol('minimax-m3.1-flash')).toBe('chat')
    expect(opencodeGoProtocol('deepseek-v4.1-flash')).toBe('chat')
  })
})

describe('opencode go adapter', () => {
  test('sends chat models to the OpenAI-compatible chat endpoint', async () => {
    const request = await capturedRequest('deepseek-v4.1-flash')

    expect(request.url).toBe('https://opencode.ai/inference/go/openai/v1/chat/completions')
    expect(request.body).toMatchObject({ model: 'deepseek-v4.1-flash' })
    expect(request.headers.authorization).toBe('Bearer oc_sk-test')
  })

  test('routes each conversation under its own session header', async () => {
    const first = await capturedRequest('deepseek-v4.1-flash')
    const second = await capturedRequest('deepseek-v4.1-flash')

    expect(first.headers['x-opencode-session']).toMatch(/^ses_[0-9a-f]+$/)
    expect(second.headers['x-opencode-session']).not.toBe(first.headers['x-opencode-session'])
  })

  test('sends GPT models to the Responses endpoint', async () => {
    const request = await capturedRequest('gpt-6-luna', 'high')

    expect(request.url).toBe('https://opencode.ai/inference/go/openai/v1/responses')
    expect(request.body).toMatchObject({
      model: 'gpt-6-luna',
      reasoning: { effort: 'high' }
    })
  })

  test('sends Claude models to the Anthropic Messages endpoint', async () => {
    const request = await capturedRequest('claude-haiku-5-5', 'high')

    expect(request.url).toBe('https://opencode.ai/inference/go/anthropic/v1/messages')
    expect(request.body).toMatchObject({
      model: 'claude-haiku-5-5',
      output_config: { effort: 'high' }
    })
    expect(request.headers['x-api-key']).toBe('oc_sk-test')
  })

  test.each([
    ['off', 'low'],
    ['minimal', 'low'],
    ['low', 'low'],
    ['xhigh', 'high']
  ] as const)('sends %s thinking as the nearest listed effort', async (level, effort) => {
    const request = await capturedRequest('deepseek-v4.1-flash', level, ['low', 'high'])

    expect(request.body).toMatchObject({ reasoning_effort: effort })
  })
})
