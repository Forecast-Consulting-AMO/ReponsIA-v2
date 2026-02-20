import { IsString, IsOptional, IsIn, IsInt } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateRequirementDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sectionNumber?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sectionTitle?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  requirementText?: string

  @ApiPropertyOptional({ enum: ['mandatory', 'optional', 'scored'] })
  @IsIn(['mandatory', 'optional', 'scored'])
  @IsOptional()
  requirementType?: 'mandatory' | 'optional' | 'scored'

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  maxScore?: number

  @ApiPropertyOptional({ enum: ['pending', 'drafted', 'reviewed', 'final'] })
  @IsIn(['pending', 'drafted', 'reviewed', 'final'])
  @IsOptional()
  responseStatus?: 'pending' | 'drafted' | 'reviewed' | 'final'

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  responseText?: string
}
