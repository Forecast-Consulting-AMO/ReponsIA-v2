import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Req,
  Res,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { DraftGroupsService } from './draft-groups.service'
import { UpdateDraftGroupDto } from './dto/update-draft-group.dto'
import type { Request, Response } from 'express'

@ApiTags('draft-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DraftGroupsController {
  constructor(private draftGroupsService: DraftGroupsService) {}

  @Get('projects/:pid/draft-groups')
  findAll(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
  ) {
    return this.draftGroupsService.findAll(pid, user.sub)
  }

  @Put('draft-groups/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDraftGroupDto,
  ) {
    return this.draftGroupsService.update(id, dto)
  }

  @Post('draft-groups/:id/generate')
  async generate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const abortController = new AbortController()
    req.on('close', () => abortController.abort())

    await this.draftGroupsService.generate(id, {
      onToken: (token) =>
        res.write(
          `data: ${JSON.stringify({ type: 'delta', text: token })}\n\n`,
        ),
      onDone: (fullText) => {
        res.write(
          `data: ${JSON.stringify({ type: 'done', text: fullText })}\n\n`,
        )
        res.end()
      },
      onError: (err) => {
        res.write(
          `data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`,
        )
        res.end()
      },
      signal: abortController.signal,
    })
  }

  @Post('projects/:pid/draft-all')
  draftAll(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
  ) {
    return this.draftGroupsService.queueDraftAll(pid, user.sub)
  }
}
