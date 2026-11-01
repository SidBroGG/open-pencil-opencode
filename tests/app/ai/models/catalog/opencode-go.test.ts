import { afterEach, describe, expect, test } from 'bun:test'

import {
  mergeOpenCodeGoModels,
  normalizeOpenCodeGoModel,
  normalizeOpenCodeGoModels,
  opencodeGoModels,
  resetOpenCodeGoModelsForTests
} from '@/app/ai/models/catalog/opencode-go'

import { fetchStub } from '#tests/helpers/fetch'

afterEach(() => resetOpenCodeGoModelsForTests())

describe('normalizeOpenCodeGoModel', () => {
  test('reads capabilities, output budget, and the efforts a model lists', () => {
    expect(
      normalizeOpenCodeGoModel({
        id: 'kimi-k3',
        name: 'Kimi K3',
        tool_call: true,
        attachment: false,
        input_modalities: ['text', 'image'],
        limit: { output: 262_144 },
        release_date: '2026-09-01',
        status: 'beta',
        reasoning_options: [{ type: 'effort', values: ['max', 'low', 'high'] }]
      })
    ).toEqual({
      id: 'kimi-k3',
      name: 'Kimi K3',
      capabilities: ['tools', 'vision'],
      recommendedMaxOutputTokens: 128_000,
      releaseDate: '2026-09-01',
      status: 'beta',
      efforts: ['low', 'high', 'xhigh']
    })
  })

  test('falls back to the slug, and skips an entry with no identifier', () => {
    expect(normalizeOpenCodeGoModel({ slug: 'glm-5.3' })).toMatchObject({ id: 'glm-5.3' })
    expect(normalizeOpenCodeGoModel({ name: 'No identifier' })).toBeNull()
    expect(normalizeOpenCodeGoModels([{ id: 'a' }, {}, null, 'text'])).toHaveLength(1)
  })

  test('reads efforts from the reasoning field as well', () => {
    expect(
      normalizeOpenCodeGoModel({
        id: 'claude-haiku-5-5',
        reasoning: { supported_efforts: ['low', 'medium', 'high'] }
      })
    ).toMatchObject({ efforts: ['low', 'medium', 'high'] })
  })
})

describe('mergeOpenCodeGoModels', () => {
  test('keeps curated names, tags, and efforts the live entry omits', () => {
    const curated = [
      {
        id: 'gpt-6-luna',
        name: 'GPT-6 Luna',
        tag: 'Fast',
        efforts: ['minimal', 'low', 'medium', 'high'] as const
      }
    ]
    expect(mergeOpenCodeGoModels(curated, [{ id: 'gpt-6-luna', name: 'gpt-6-luna' }])).toEqual([
      {
        id: 'gpt-6-luna',
        name: 'GPT-6 Luna',
        tag: 'Fast',
        efforts: ['minimal', 'low', 'medium', 'high']
      }
    ])
  })

  test('lets the live entry decide the efforts it reports', () => {
    const curated = [{ id: 'llama', name: 'Llama', efforts: ['low', 'high'] as const }]
    expect(
      mergeOpenCodeGoModels(curated, [
        { id: 'llama', name: 'llama', efforts: ['low', 'medium', 'high'] as const }
      ])
    ).toEqual([{ id: 'llama', name: 'Llama', efforts: ['low', 'medium', 'high'] }])
  })
})

describe('opencodeGoModels', () => {
  test('reads the live list, keeping curated names for known models', async () => {
    const fetcher = fetchStub(async () =>
      Response.json({
        data: [
          { id: 'kimi-k3', name: 'kimi-k3', input_modalities: ['text'] },
          { id: 'some-new-model', name: 'Some New Model' }
        ]
      })
    )

    const models = await opencodeGoModels(fetcher)

    expect(models.map((model) => model.id)).toEqual(['kimi-k3', 'some-new-model'])
    expect(models[0]).toMatchObject({
      name: 'Kimi K3',
      tag: 'Vision + code',
      efforts: ['low', 'high', 'xhigh']
    })
    expect(models[1]).toEqual({ id: 'some-new-model', name: 'Some New Model', capabilities: ['tools'] })
  })

  test('accepts a bare array and a models envelope', async () => {
    const bare = await opencodeGoModels(
      fetchStub(async () => Response.json([{ id: 'one' }]))
    )
    const envelope = await opencodeGoModels(
      fetchStub(async () => Response.json({ models: [{ id: 'two' }] }))
    )

    expect(bare.map((model) => model.id)).toEqual(['one'])
    expect(envelope.map((model) => model.id)).toEqual(['two'])
  })

  test('falls back to the curated catalog when the request fails or is malformed', async () => {
    const failing = await opencodeGoModels(fetchStub(async () => new Response('', { status: 500 })))
    const malformed = await opencodeGoModels(fetchStub(async () => new Response('not json')))

    expect(failing.some((model) => model.id === 'deepseek-v4.1-flash')).toBe(true)
    expect(malformed.some((model) => model.id === 'deepseek-v4.1-flash')).toBe(true)
  })
})
