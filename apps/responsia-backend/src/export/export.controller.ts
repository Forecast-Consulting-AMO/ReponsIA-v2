import {
  Controller,
  Post,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Res,
} from '@nestjs/common'
import { Response } from 'express'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ExportService } from './export.service'

@ApiTags('export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ExportController {
  constructor(private exportService: ExportService) {}

  @Post('projects/:pid/export')
  async exportDocx(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
    @Body() body: { format?: 'clean' | 'template' },
    @Res() res: Response,
  ) {
    // Template-based export will be added later
    const buffer = await this.exportService.exportClean(pid, user.sub)

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="reponse-ao-${pid}.docx"`)
    res.send(buffer)
  }
}
