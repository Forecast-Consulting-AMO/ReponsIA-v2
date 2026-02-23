import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { OutlineService } from './outline.service'
import { CreateOutlineSectionDto } from './dto/create-outline-section.dto'
import { UpdateOutlineSectionDto } from './dto/update-outline-section.dto'
import { ReorderSectionsDto } from './dto/reorder-sections.dto'

@ApiTags('outline')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class OutlineController {
  constructor(private outlineService: OutlineService) {}

  @Post('projects/:pid/outline/analyze')
  analyze(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
  ) {
    return this.outlineService.analyzeStructure(pid, user.sub)
  }

  @Get('projects/:pid/outline')
  findAll(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
  ) {
    return this.outlineService.findAll(pid, user.sub)
  }

  @Post('projects/:pid/outline')
  create(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateOutlineSectionDto,
  ) {
    return this.outlineService.create(pid, user.sub, dto)
  }

  @Put('outline/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOutlineSectionDto,
  ) {
    return this.outlineService.update(id, dto)
  }

  @Delete('outline/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.outlineService.remove(id)
  }

  @Put('projects/:pid/outline/reorder')
  reorder(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
    @Body() dto: ReorderSectionsDto,
  ) {
    return this.outlineService.reorder(pid, user.sub, dto.sections)
  }
}
