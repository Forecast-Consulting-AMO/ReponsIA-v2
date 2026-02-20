import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthGuard } from '@nestjs/passport'

const DEV_USER = { sub: 'dev|local-user', email: 'dev@responsia.local' }

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  private authDisabled: boolean

  constructor(private configService: ConfigService) {
    super()
    this.authDisabled =
      this.configService.get('AUTH_DISABLED') === 'true' ||
      this.configService.get('AUTH_DISABLED') === true
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.authDisabled) {
      const request = context.switchToHttp().getRequest()
      request.user = DEV_USER
      return true
    }
    return super.canActivate(context) as Promise<boolean>
  }
}
