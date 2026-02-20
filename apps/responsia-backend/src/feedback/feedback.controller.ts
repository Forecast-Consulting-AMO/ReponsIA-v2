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
import { FeedbackService } from './feedback.service'
import { UpdateFeedbackDto } from './dto/update-feedback.dto'

@ApiTags('feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class FeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  @Get('projects/:pid/feedback')
  findAll(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
  ) {
    return this.feedbackService.findAllByProject(pid, user.sub)
  }

  @Post('projects/:pid/feedback/extract')
  extract(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
  ) {
    return this.feedbackService.queueExtraction(pid, user.sub)
  }

  @Put('feedback/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFeedbackDto,
  ) {
    return this.feedbackService.update(id, dto)
  }

  @Delete('feedback/:id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.feedbackService.remove(id)
    return { success: true }
  }
}
