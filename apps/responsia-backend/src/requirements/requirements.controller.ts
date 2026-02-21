import {
  Controller,
  Get,
  Put,
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
import { RequirementsService } from './requirements.service'
import { UpdateRequirementDto } from './dto/update-requirement.dto'

@ApiTags('requirements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class RequirementsController {
  constructor(
    private requirementsService: RequirementsService,
    private aiService: AiService,
  ) {}

  @Get('projects/:pid/requirements')
  findAll(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
  ) {
    return this.requirementsService.findAllByProject(pid, user.sub)
  }

  @Put('requirements/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRequirementDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.requirementsService.update(id, dto, user.sub)
  }

  /** SSE endpoint: stream a draft response for a single requirement */
  @Get('requirements/:id/draft')
  async draft(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { sub: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.requirementsService.verifyAccessByRequirement(id, user.sub)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const abortController = new AbortController()
    req.on('close', () => abortController.abort())

    const requirement = await this.requirementsService.findOne(id)

    // Build context: knowledge base + matched feedback
    const knowledgeContext = await this.requirementsService.getKnowledgeContext(
      requirement.projectId,
      requirement.requirementText,
    )
    const feedbackItems = await this.requirementsService.getMatchedFeedback(id)
    const feedbackContext = feedbackItems.length > 0
      ? feedbackItems
          .map((f) => `[${f.feedbackType}/${f.severity}] ${f.content}`)
          .join('\n')
      : ''

    // Resolve model + prompt (defaults for now; project/user overrides in settings module)
    const model = this.aiService.resolveModel('drafting')
    const systemPrompt = this.aiService.resolvePrompt('drafting')
    const fullSystem =
      systemPrompt +
      (knowledgeContext ? `\n\nContexte de la base de connaissances:\n${knowledgeContext}` : '') +
      (feedbackContext ? `\n\nRetours précédents à intégrer:\n${feedbackContext}` : '')

    await this.aiService.stream(
      model,
      fullSystem,
      `Exigence: ${requirement.requirementText}`,
      {
        onToken: (token) => {
          res.write(`data: ${JSON.stringify({ type: 'delta', text: token })}\n\n`)
        },
        onDone: async (fullText) => {
          await this.requirementsService.saveResponse(id, fullText)
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
          res.end()
        },
        onError: (error) => {
          res.write(
            `data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`,
          )
          res.end()
        },
        signal: abortController.signal,
      },
    )
  }

  @Post('projects/:pid/analyze')
  queueAnalysis(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
  ) {
    return this.requirementsService.queueAnalysis(pid, user.sub)
  }

  @Post('projects/:pid/draft-all')
  queueDraftAll(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
  ) {
    return this.requirementsService.queueDraftAll(pid, user.sub)
  }
}
