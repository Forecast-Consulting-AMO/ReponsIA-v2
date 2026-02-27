import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ExtractionService } from './extraction.service'
import { UpdateItemDto } from './dto/update-item.dto'

@ApiTags('extraction')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ExtractionController {
  constructor(private extractionService: ExtractionService) {}

  @Post('projects/:pid/extract')
  async extract(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
  ) {
    const job = await this.extractionService.startExtractItems(pid, user.sub)
    return { jobId: job.id, status: job.status }
  }

  @Get('projects/:pid/items')
  findAll(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
  ) {
    return this.extractionService.findAll(pid, user.sub)
  }

  @Get('projects/:pid/items/by-theme')
  findByTheme(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
  ) {
    return this.extractionService.findByTheme(pid, user.sub)
  }

  @Put('items/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateItemDto,
  ) {
    return this.extractionService.update(id, dto)
  }
}
