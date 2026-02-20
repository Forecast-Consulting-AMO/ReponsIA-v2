import { IsString, IsOptional, IsIn } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateProjectDto {
  @ApiProperty()
  @IsString()
  name: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string

  @ApiPropertyOptional({ enum: ['fr', 'en', 'nl'], default: 'fr' })
  @IsIn(['fr', 'en', 'nl'])
  @IsOptional()
  contentLanguage?: 'fr' | 'en' | 'nl'

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  deadline?: string
}
