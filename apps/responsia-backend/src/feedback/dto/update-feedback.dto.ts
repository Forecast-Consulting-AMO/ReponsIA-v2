import { IsString, IsOptional, IsIn, IsBoolean, IsInt } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateFeedbackDto {
  @ApiPropertyOptional({ enum: ['strength', 'weakness', 'recommendation', 'comment'] })
  @IsIn(['strength', 'weakness', 'recommendation', 'comment'])
  @IsOptional()
  feedbackType?: 'strength' | 'weakness' | 'recommendation' | 'comment'

  @ApiPropertyOptional({ enum: ['critical', 'major', 'minor', 'info'] })
  @IsIn(['critical', 'major', 'minor', 'info'])
  @IsOptional()
  severity?: 'critical' | 'major' | 'minor' | 'info'

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  content?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sectionReference?: string

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  requirementId?: number

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  addressed?: boolean
}
