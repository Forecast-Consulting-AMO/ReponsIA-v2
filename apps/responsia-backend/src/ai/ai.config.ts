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
    modelId: 'claude-sonnet-4-6-20250514',
    maxOutput: 16384,
  },
  {
    id: 'claude-opus-4.6',
    label: 'Claude Opus 4.6',
    provider: 'anthropic',
    modelId: 'claude-opus-4-6-20250514',
    maxOutput: 16384,
  },
  {
    id: 'gpt-chat-5.2',
    label: 'GPT Chat 5.2',
    provider: 'openai',
    modelId: 'gpt-chat-5.2',
    maxOutput: 32768,
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
  embedding: 'gpt-chat-5.2',
}

export function getModelById(id: string): AiModel | undefined {
  return AI_MODELS.find((m) => m.id === id)
}
