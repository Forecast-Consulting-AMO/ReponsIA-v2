import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AiService } from '../ai/ai.service'
import { ChatService } from './chat.service'
import { SendMessageDto, EditSuggestionDto } from './dto/send-message.dto'

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ChatController {
  constructor(
    private chatService: ChatService,
    private aiService: AiService,
  ) {}

  @Get('projects/:pid/chat')
  findAll(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
  ) {
    return this.chatService.findAllByProject(pid, user.sub)
  }

  /** SSE: Send a chat message and stream the AI response */
  @Post('projects/:pid/chat')
  async send(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
    @Body() dto: SendMessageDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.chatService.verifyAccess(pid, user.sub)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const abortController = new AbortController()
    req.on('close', () => abortController.abort())

    await this.chatService.saveUserMessage(pid, user.sub, dto.message)

    const knowledgeContext = await this.chatService.getProjectContext(pid, dto.message)
    const chatHistory = await this.chatService.getChatHistory(pid)

    const model = this.aiService.resolveModel('chat')
    const systemPrompt =
      this.aiService.resolvePrompt('chat') +
      (knowledgeContext ? `\n\nContexte du projet:\n${knowledgeContext}` : '') +
      (chatHistory ? `\n\nHistorique:\n${chatHistory}` : '')

    await this.aiService.stream(model, systemPrompt, dto.message, {
      onToken: (token) => {
        res.write(`data: ${JSON.stringify({ type: 'delta', text: token })}\n\n`)
      },
      onDone: async (fullText) => {
        await this.chatService.saveAssistantMessage(pid, user.sub, fullText)
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
        res.end()
      },
      onError: (error) => {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`)
        res.end()
      },
      signal: abortController.signal,
    })
  }

  /** SSE: Request an edit suggestion for a requirement (split diff view) */
  @Post('projects/:pid/chat/edit')
  async editSuggestion(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
    @Body() dto: EditSuggestionDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.chatService.verifyAccess(pid, user.sub)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const abortController = new AbortController()
    req.on('close', () => abortController.abort())

    const { requirement } = await this.chatService.getRequirementText(dto.requirementId)
    const currentText = requirement.responseText || ''

    const model = this.aiService.resolveModel('chat')
    const systemPrompt = `Vous êtes un assistant d'édition. L'utilisateur demande une modification de la réponse suivante à une exigence d'appel d'offres.

Réponse actuelle:
---
${currentText}
---

Instruction de modification: ${dto.instruction}

Réécrivez la réponse en appliquant la modification demandée. Retournez UNIQUEMENT le texte modifié, sans commentaire ni explication.`

    await this.aiService.stream(model, systemPrompt, dto.instruction, {
      onToken: (token) => {
        res.write(`data: ${JSON.stringify({ type: 'delta', text: token })}\n\n`)
      },
      onDone: async (newText) => {
        // Save as chat message with edit diff
        await this.chatService.saveAssistantMessage(pid, user.sub, newText, {
          requirementId: dto.requirementId,
          editDiff: { old: currentText, new: newText },
        })
        res.write(
          `data: ${JSON.stringify({
            type: 'done',
            diff: { old: currentText, new: newText },
            requirementId: dto.requirementId,
          })}\n\n`,
        )
        res.end()
      },
      onError: (error) => {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`)
        res.end()
      },
      signal: abortController.signal,
    })
  }
}
