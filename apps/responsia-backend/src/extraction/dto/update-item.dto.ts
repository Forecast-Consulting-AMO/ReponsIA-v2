import {
  IsOptional,
  IsString,
  IsInt,
  IsIn,
  IsBoolean,
  IsArray,
} from 'class-validator'

export class UpdateItemDto {
  @IsOptional() @IsIn(['question', 'condition']) kind?: string

  @IsOptional() @IsInt() outlineSectionId?: number

  @IsOptional() @IsString() responseText?: string

  @IsOptional() @IsBoolean() addressed?: boolean

  @IsOptional()
  @IsIn(['pending', 'drafted', 'reviewed', 'final'])
  status?: string

  @IsOptional() @IsArray() aiThemes?: string[]
}
