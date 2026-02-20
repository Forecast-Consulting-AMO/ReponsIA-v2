import {
  Controller,
  Get,
  Post,
  Param,
  ParseIntPipe,
  UseGuards,
  Res,
} from '@nestjs/common'
import { Response } from 'express'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { SetupService } from './setup.service'

@ApiTags('setup')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SetupController {
  constructor(private setupService: SetupService) {}

  /** Trigger the full Phase A pipeline */
  @Post('projects/:pid/setup/start')
  start(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
  ) {
    return this.setupService.start(pid, user.sub)
  }

  /** SSE stream of pipeline progress */
  @Get('projects/:pid/setup/progress')
  async progress(
    @Param('pid', ParseIntPipe) pid: number,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    // Poll job progress every 2 seconds
    const interval = setInterval(async () => {
      try {
        const jobs = await this.setupService.getProgress(pid)
        res.write(`data: ${JSON.stringify({ type: 'progress', jobs })}\n\n`)

        // If all jobs are completed or errored, close the stream
        const allDone = jobs.length > 0 && jobs.every(
          (j) => j.status === 'completed' || j.status === 'error',
        )
        if (allDone) {
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
          clearInterval(interval)
          res.end()
        }
      } catch {
        clearInterval(interval)
        res.end()
      }
    }, 2000)

    // Clean up on client disconnect
    res.on('close', () => {
      clearInterval(interval)
    })
  }
}
