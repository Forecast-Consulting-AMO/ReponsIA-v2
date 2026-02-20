import { IsString, IsOptional, IsIn, IsObject } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string

  @ApiPropertyOptional({ enum: ['draft', 'in_progress', 'completed'] })
  @IsIn(['draft', 'in_progress', 'completed'])
  @IsOptional()
  status?: 'draft' | 'in_progress' | 'completed'

  @ApiPropertyOptional({ enum: ['fr', 'en', 'nl'] })
  @IsIn(['fr', 'en', 'nl'])
  @IsOptional()
  contentLanguage?: 'fr' | 'en' | 'nl'

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  deadline?: string

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  modelOverrides?: Record<string, string>

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  promptOverrides?: Record<string, string>
}
