import { uniq } from 'es-toolkit/array'
import * as v from 'valibot'

import { AI_PROVIDERS, REASONING_EFFORTS } from '@open-pencil/core/constants'
import type { ModelOption, ReasoningEffort } from '@open-pencil/core/constants'

import { modelOptionsSchema } from '@/app/ai/models/catalog/schema'
import { OPENCODE_GO_BASE_URL } from '@/app/ai/providers/opencode-go/model'
import { cachedRemoteJSON } from '@/app/cache/remote'

const MODELS_URL = `${OPENCODE_GO_BASE_URL}/v1/models`
const MODELS_CACHE_KEY = 'opencode-go/models'
const MODELS_CACHE_TTL_MS = 24 * 60 * 60 * 1000
// The picker waits for this list, so a stalled request falls back to the curated models.
const MODELS_TIMEOUT_MS = 10_000

// The endpoint answers an OpenAI-style envelope; the bare and `models` shapes are accepted too,
// because Go has shipped more than one.
const modelsResponseSchema = v.union([
  v.array(v.unknown()),
  v.object({ data: v.array(v.unknown()) }),
  v.object({ models: v.array(v.unknown()) })
])

const modelsTextSchema = v.pipe(v.string(), v.parseJson(), modelsResponseSchema)

const modelEntrySchema = v.looseObject({
  id: v.optional(v.unknown()),
  slug: v.optional(v.unknown()),
  name: v.optional(v.unknown()),
  display_name: v.optional(v.unknown()),
  tool_call: v.optional(v.unknown()),
  attachment: v.optional(v.unknown()),
  input_modalities: v.optional(v.unknown()),
  modalities: v.optional(v.looseObject({ input: v.optional(v.unknown()) })),
  limit: v.optional(v.looseObject({ output: v.optional(v.unknown()) })),
  max_output_tokens: v.optional(v.unknown()),
  release_date: v.optional(v.unknown()),
  status: v.optional(v.unknown()),
  reasoning: v.optional(v.unknown()),
  reasoning_options: v.optional(v.unknown()),
  supported_efforts: v.optional(v.unknown())
})
type ModelEntry = v.InferOutput<typeof modelEntrySchema>

const effortOptionSchema = v.looseObject({
  type: v.optional(v.unknown()),
  values: v.optional(v.unknown())
})

const reasoningSchema = v.looseObject({ supported_efforts: v.optional(v.unknown()) })

function isName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function entriesOf(value: v.InferOutput<typeof modelsResponseSchema>): unknown[] {
  if (Array.isArray(value)) return value
  if ('data' in value) return value.data
  return value.models
}

/** The efforts a provider lists, in the order the app offers them; `max` means `xhigh`. */
function effortValues(value: unknown): ReasoningEffort[] {
  if (!Array.isArray(value)) return []
  const mapped = value.flatMap((entry): ReasoningEffort[] => {
    if (typeof entry !== 'string') return []
    const name = entry.toLowerCase() === 'max' ? 'xhigh' : entry.toLowerCase()
    const matched = REASONING_EFFORTS.find((effort) => effort === name)
    return matched ? [matched] : []
  })
  return uniq(mapped).sort(
    (left, right) => REASONING_EFFORTS.indexOf(left) - REASONING_EFFORTS.indexOf(right)
  )
}

function listedEfforts(entry: ModelEntry): ReasoningEffort[] {
  const direct = effortValues(entry.supported_efforts)
  if (direct.length) return direct
  if (Array.isArray(entry.reasoning_options)) {
    for (const option of entry.reasoning_options) {
      if (!v.is(effortOptionSchema, option) || option.type !== 'effort') continue
      const values = effortValues(option.values)
      if (values.length) return values
    }
  }
  if (v.is(reasoningSchema, entry.reasoning)) {
    return effortValues(entry.reasoning.supported_efforts)
  }
  return []
}

function inputModalities(entry: ModelEntry): unknown[] {
  if (Array.isArray(entry.input_modalities)) return entry.input_modalities
  const input = entry.modalities?.input
  return Array.isArray(input) ? input : []
}

/** Go is a coding catalog, so a model counts as tool-capable unless it says otherwise. */
function capabilitiesOf(entry: ModelEntry): ('tools' | 'vision')[] {
  const tools: ('tools' | 'vision')[] = entry.tool_call === false ? [] : ['tools']
  const vision = entry.attachment === true || inputModalities(entry).includes('image')
  return vision ? [...tools, 'vision'] : tools
}

function outputTokensOf(entry: ModelEntry): number | undefined {
  const output = entry.limit?.output ?? entry.max_output_tokens
  if (typeof output !== 'number' || !Number.isFinite(output)) return undefined
  return Math.min(128_000, Math.max(1024, output))
}

export function normalizeOpenCodeGoModel(value: unknown): ModelOption | null {
  if (!v.is(modelEntrySchema, value)) return null
  const id = [value.id, value.slug].find(isName)
  if (!id) return null

  const option: ModelOption = {
    id,
    name: [value.name, value.display_name].find(isName) ?? id,
    capabilities: capabilitiesOf(value)
  }
  const efforts = listedEfforts(value)
  if (efforts.length) option.efforts = efforts
  const outputTokens = outputTokensOf(value)
  if (outputTokens !== undefined) option.recommendedMaxOutputTokens = outputTokens
  if (isName(value.release_date)) option.releaseDate = value.release_date
  if (value.status === 'beta' || value.status === 'deprecated') option.status = value.status

  return option
}

export function normalizeOpenCodeGoModels(entries: unknown[]): ModelOption[] {
  return entries.flatMap((entry) => {
    const model = normalizeOpenCodeGoModel(entry)
    return model ? [model] : []
  })
}

/** The live list decides what exists; curated entries keep their names, tags, and efforts. */
export function mergeOpenCodeGoModels(
  curated: readonly ModelOption[],
  listed: readonly ModelOption[]
): ModelOption[] {
  const curatedById = new Map(curated.map((model) => [model.id, model]))
  return listed.map((model) => {
    const known = curatedById.get(model.id)
    if (!known) return model
    return {
      ...model,
      name: known.name,
      ...(known.tag ? { tag: known.tag } : {}),
      ...(model.efforts?.length || !known.efforts ? {} : { efforts: known.efforts })
    }
  })
}

const models = cachedRemoteJSON<ModelOption[]>({
  key: MODELS_CACHE_KEY,
  schema: modelOptionsSchema,
  maxAgeMs: MODELS_CACHE_TTL_MS,
  load: async (fetcher) => {
    const response = await fetcher(MODELS_URL, {
      signal: AbortSignal.timeout(MODELS_TIMEOUT_MS)
    })
    if (!response.ok) throw new Error(`OpenCode Go models request failed: ${response.status}`)
    const parsed = v.safeParse(modelsTextSchema, await response.text())
    if (!parsed.success) return null
    const normalized = normalizeOpenCodeGoModels(entriesOf(parsed.output))
    return normalized.length ? normalized : null
  }
})

function curatedModels(): ModelOption[] {
  return AI_PROVIDERS.find((provider) => provider.id === 'opencode-go')?.models ?? []
}

/** Go's models as the picker and a runtime need them: live when reachable, curated otherwise. */
export async function opencodeGoModels(fetcher?: typeof fetch): Promise<ModelOption[]> {
  const curated = curatedModels()
  const listed = await models.get(fetcher)
  return listed ? mergeOpenCodeGoModels(curated, listed) : curated
}

export function resetOpenCodeGoModelsForTests(): void {
  models.reset()
}
