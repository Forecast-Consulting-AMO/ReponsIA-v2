import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import {
  AI_MODELS,
  DEFAULT_MODELS,
  getModelById,
  type AiModel,
  type OperationType,
} from './ai.config'
import { PROMPTS, type PromptKey } from './prompts'

export interface StreamCallbacks {
  onToken: (token: string) => void
  onDone: (fullText: string) => void
  onError: (error: Error) => void
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)
  private anthropic: Anthropic | null = null
  private openai: OpenAI | null = null

  constructor(private config: ConfigService) {
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY')
    if (anthropicKey) {
      this.anthropic = new Anthropic({ apiKey: anthropicKey })
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not set — Anthropic models unavailable')
    }

    const openaiKey = this.config.get<string>('OPENAI_API_KEY')
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey })
    } else {
      this.logger.warn('OPENAI_API_KEY not set — OpenAI models unavailable')
    }
  }

  /** Get available models list (for settings UI) */
  getAvailableModels() {
    return AI_MODELS.map((m) => ({
      ...m,
      available:
        m.provider === 'anthropic' ? !!this.anthropic : !!this.openai,
    }))
  }

  /** Resolve which model to use for an operation, respecting overrides */
  resolveModel(
    operation: OperationType,
    projectOverrides?: Record<string, string> | null,
    userDefaults?: Record<string, string> | null,
  ): AiModel {
    const modelId =
      projectOverrides?.[operation] ??
      userDefaults?.[operation] ??
      DEFAULT_MODELS[operation]
    return getModelById(modelId) ?? getModelById(DEFAULT_MODELS[operation])!
  }

  /** Resolve the system prompt for an operation, respecting overrides */
  resolvePrompt(
    operation: OperationType,
    projectOverrides?: Record<string, string> | null,
    userDefaults?: Record<string, string> | null,
  ): string {
    return (
      projectOverrides?.[operation] ??
      userDefaults?.[operation] ??
      PROMPTS[operation as PromptKey] ??
      ''
    )
  }

  /** Generate a complete (non-streaming) text response */
  async generate(
    model: AiModel,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    if (model.provider === 'anthropic') {
      if (!this.anthropic) throw new Error('Anthropic API key not configured')
      const resp = await this.anthropic.messages.create({
        model: model.modelId,
        max_tokens: model.maxOutput,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })
      return resp.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('')
    }

    if (!this.openai) throw new Error('OpenAI API key not configured')
    const resp = await this.openai.chat.completions.create({
      model: model.modelId,
      max_tokens: model.maxOutput,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })
    return resp.choices[0]?.message?.content ?? ''
  }

  /** Stream a text response, calling onToken for each chunk */
  async stream(
    model: AiModel,
    systemPrompt: string,
    userPrompt: string,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    let fullText = ''

    try {
      if (model.provider === 'anthropic') {
        if (!this.anthropic) throw new Error('Anthropic API key not configured')
        const stream = this.anthropic.messages.stream({
          model: model.modelId,
          max_tokens: model.maxOutput,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        })
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            fullText += event.delta.text
            callbacks.onToken(event.delta.text)
          }
        }
      } else {
        if (!this.openai) throw new Error('OpenAI API key not configured')
        const stream = await this.openai.chat.completions.create({
          model: model.modelId,
          max_tokens: model.maxOutput,
          stream: true,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        })
        for await (const chunk of stream) {
          const token = chunk.choices[0]?.delta?.content
          if (token) {
            fullText += token
            callbacks.onToken(token)
          }
        }
      }
      callbacks.onDone(fullText)
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  /** Generate embeddings using OpenAI text-embedding-3-small */
  async embed(text: string): Promise<number[]> {
    if (!this.openai) throw new Error('OpenAI API key not configured (needed for embeddings)')
    const resp = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    })
    return resp.data[0].embedding
  }

  /** Batch embed multiple texts */
  async embedMany(texts: string[]): Promise<number[][]> {
    if (!this.openai) throw new Error('OpenAI API key not configured (needed for embeddings)')
    const resp = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    })
    return resp.data.map((d) => d.embedding)
  }
}
