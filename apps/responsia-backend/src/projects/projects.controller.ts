import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ProjectsService } from './projects.service'
import { CreateProjectDto } from './dto/create-project.dto'
import { UpdateProjectDto } from './dto/update-project.dto'
import { InviteMemberDto } from './dto/invite-member.dto'

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  findAll(@CurrentUser() user: { sub: string }) {
    return this.projectsService.findAll(user.sub)
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { sub: string },
  ) {
    return this.projectsService.findOne(id, user.sub)
  }

  @Post()
  create(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(user.sub, dto)
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, user.sub, dto)
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { sub: string },
  ) {
    await this.projectsService.remove(id, user.sub)
    return { success: true }
  }

  // --- Members ---

  @Get(':pid/members')
  getMembers(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
  ) {
    return this.projectsService.getMembers(pid, user.sub)
  }

  @Post(':pid/members/invite')
  inviteMember(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
    @Body() dto: InviteMemberDto,
  ) {
    return this.projectsService.inviteMember(pid, user.sub, dto)
  }

  @Delete(':pid/members/:memberId')
  async removeMember(
    @Param('pid', ParseIntPipe) pid: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @CurrentUser() user: { sub: string },
  ) {
    await this.projectsService.removeMember(pid, memberId, user.sub)
    return { success: true }
  }
}
