import { IsString, IsOptional, IsInt } from 'class-validator'

export class UpdateOutlineSectionDto {
  @IsOptional() @IsString() title?: string

  @IsOptional() @IsString() description?: string

  @IsOptional() @IsInt() parentId?: number

  @IsOptional() @IsInt() position?: number
}
