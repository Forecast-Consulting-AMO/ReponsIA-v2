import { IsEmail, IsIn } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class InviteMemberDto {
  @ApiProperty({ example: 'colleague@company.com' })
  @IsEmail()
  email: string

  @ApiProperty({ enum: ['editor', 'viewer'], default: 'editor' })
  @IsIn(['editor', 'viewer'])
  role: 'editor' | 'viewer'
}
