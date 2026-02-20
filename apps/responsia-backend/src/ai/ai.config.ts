/**
 * Model registry for ReponsIA.
 * Each operation type can be assigned a different model.
 */

export interface AiModel {
  id: string
  label: string
  provider: 'anthropic' | 'openai'
  /** The actual model name passed to the SDK */
  modelId: string
  /** Max tokens for this model's output */
  maxOutput: number
}

export const AI_MODELS: AiModel[] = [
  // Anthropic
  {
    id: 'claude-opus',
    label: 'Claude Opus 4',
    provider: 'anthropic',
    modelId: 'claude-opus-4-0-20250514',
    maxOutput: 16384,
  },
  {
    id: 'claude-sonnet',
    label: 'Claude Sonnet 4',
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-5-20250929',
    maxOutput: 16384,
  },
  {
    id: 'claude-haiku',
    label: 'Claude Haiku 3.5',
    provider: 'anthropic',
    modelId: 'claude-haiku-4-5-20251001',
    maxOutput: 8192,
  },
  // OpenAI
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'openai',
    modelId: 'gpt-4o',
    maxOutput: 16384,
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    maxOutput: 16384,
  },
  {
    id: 'gpt-4.1',
    label: 'GPT-4.1',
    provider: 'openai',
    modelId: 'gpt-4.1',
    maxOutput: 32768,
  },
  {
    id: 'gpt-4.1-mini',
    label: 'GPT-4.1 Mini',
    provider: 'openai',
    modelId: 'gpt-4.1-mini',
    maxOutput: 32768,
  },
]

/** Operation types that can each have a different model assigned */
export type OperationType =
  | 'analysis'
  | 'drafting'
  | 'feedback'
  | 'compliance'
  | 'chat'
  | 'embedding'

/** Default model assignments per operation */
export const DEFAULT_MODELS: Record<OperationType, string> = {
  analysis: 'claude-sonnet',
  drafting: 'claude-sonnet',
  feedback: 'claude-sonnet',
  compliance: 'claude-sonnet',
  chat: 'claude-haiku',
  embedding: 'gpt-4o-mini', // OpenAI embeddings only
}

export function getModelById(id: string): AiModel | undefined {
  return AI_MODELS.find((m) => m.id === id)
}
