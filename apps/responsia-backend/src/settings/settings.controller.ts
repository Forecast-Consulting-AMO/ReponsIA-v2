import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { SettingsService } from './settings.service'

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get('models')
  getModels() {
    return this.settingsService.getModels()
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: { sub: string }) {
    return this.settingsService.getPreferences(user.sub)
  }

  @Put('preferences')
  updatePreferences(
    @CurrentUser() user: { sub: string },
    @Body() body: { models?: Record<string, string>; prompts?: Record<string, string> },
  ) {
    return this.settingsService.updatePreferences(user.sub, body)
  }
}

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ProjectSettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get('projects/:pid/settings')
  getProjectSettings(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
  ) {
    return this.settingsService.getProjectSettings(pid, user.sub)
  }

  @Put('projects/:pid/settings')
  updateProjectSettings(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
    @Body()
    body: {
      models?: Record<string, string>
      prompts?: Record<string, string>
      contentLanguage?: 'fr' | 'en' | 'nl'
    },
  ) {
    return this.settingsService.updateProjectSettings(pid, user.sub, body)
  }
}
