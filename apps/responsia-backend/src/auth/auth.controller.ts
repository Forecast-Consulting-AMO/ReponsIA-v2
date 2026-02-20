import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from './jwt-auth.guard'
import { CurrentUser } from './decorators/current-user.decorator'
import { AuthService } from './auth.service'

@ApiTags('auth')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('me')
  async me(@CurrentUser() user: { sub: string; email: string }) {
    return this.authService.syncProfile(user.sub, user.email || 'unknown')
  }

  @Put('profile')
  async updateProfile(
    @CurrentUser() user: { sub: string },
    @Body()
    body: {
      displayName?: string
      agentInstructions?: string
      defaultModels?: Record<string, string>
      defaultPrompts?: Record<string, string>
    },
  ) {
    return this.authService.updateProfile(user.sub, body)
  }
}
