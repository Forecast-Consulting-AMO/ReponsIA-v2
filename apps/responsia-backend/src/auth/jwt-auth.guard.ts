import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthGuard } from '@nestjs/passport'
import { AuthService } from './auth.service'

const DEV_USER = { sub: 'dev|local-user', email: 'dev@responsia.local' }

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  private authDisabled: boolean
  private profileSynced = false

  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super()
    this.authDisabled =
      this.configService.get('AUTH_DISABLED') === 'true' ||
      this.configService.get('AUTH_DISABLED') === true
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.authDisabled) {
      const request = context.switchToHttp().getRequest()
      if (!this.profileSynced) {
        await this.authService.syncProfile(DEV_USER.sub, DEV_USER.email)
        this.profileSynced = true
      }
      request.user = DEV_USER
      return true
    }
    return super.canActivate(context) as Promise<boolean>
  }
}
