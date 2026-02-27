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
  {
    id: 'claude-sonnet-4.6',
    label: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-6',
    maxOutput: 16384,
  },
  {
    id: 'claude-opus-4.6',
    label: 'Claude Opus 4.6',
    provider: 'anthropic',
    modelId: 'claude-opus-4-6',
    maxOutput: 16384,
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'openai',
    modelId: 'gpt-4o',
    maxOutput: 16384,
  },
]

/** Operation types that can each have a different model assigned */
export type OperationType =
  | 'analysis'
  | 'structure'
  | 'extraction'
  | 'drafting'
  | 'feedback'
  | 'compliance'
  | 'chat'
  | 'embedding'

/** Default model assignments per operation */
export const DEFAULT_MODELS: Record<OperationType, string> = {
  analysis: 'claude-sonnet-4.6',
  structure: 'claude-sonnet-4.6',
  extraction: 'claude-sonnet-4.6',
  drafting: 'claude-sonnet-4.6',
  feedback: 'claude-sonnet-4.6',
  compliance: 'claude-sonnet-4.6',
  chat: 'claude-sonnet-4.6',
  embedding: 'gpt-4o',
}

export function getModelById(id: string): AiModel | undefined {
  return AI_MODELS.find((m) => m.id === id)
}
