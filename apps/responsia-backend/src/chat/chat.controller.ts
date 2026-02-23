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

  /** SSE: Request an edit suggestion for an extracted item (split diff view) */
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

    const { item } = await this.chatService.getItemText(dto.itemId)
    const currentText = item.responseText || ''

    const model = this.aiService.resolveModel('chat')
    const systemPrompt = `Vous etes un assistant d'edition. L'utilisateur demande une modification de la reponse suivante a un element d'appel d'offres.

Reponse actuelle:
---
${currentText}
---

Instruction de modification: ${dto.instruction}

Reecrivez la reponse en appliquant la modification demandee. Retournez UNIQUEMENT le texte modifie, sans commentaire ni explication.`

    await this.aiService.stream(model, systemPrompt, dto.instruction, {
      onToken: (token) => {
        res.write(`data: ${JSON.stringify({ type: 'delta', text: token })}\n\n`)
      },
      onDone: async (newText) => {
        // Save as chat message with edit diff
        await this.chatService.saveAssistantMessage(pid, user.sub, newText, {
          itemId: dto.itemId,
          editDiff: { old: currentText, new: newText },
        })
        res.write(
          `data: ${JSON.stringify({
            type: 'done',
            diff: { old: currentText, new: newText },
            itemId: dto.itemId,
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
