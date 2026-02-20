import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Query,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { KnowledgeService } from './knowledge.service'

@ApiTags('knowledge')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class KnowledgeController {
  constructor(private knowledgeService: KnowledgeService) {}

  @Get('projects/:pid/knowledge')
  findAll(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
  ) {
    return this.knowledgeService.findAllByProject(pid, user.sub)
  }

  @Post('projects/:pid/knowledge/index')
  index(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
  ) {
    return this.knowledgeService.queueIndexing(pid, user.sub)
  }

  @Post('projects/:pid/knowledge/search')
  search(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
    @Body() body: { query: string; limit?: number },
  ) {
    return this.knowledgeService.search(pid, user.sub, body.query, body.limit)
  }
}
