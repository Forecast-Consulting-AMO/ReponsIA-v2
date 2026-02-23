import { IsString, IsOptional, IsInt, IsIn } from 'class-validator'

export class CreateOutlineSectionDto {
  @IsString() title: string

  @IsOptional() @IsString() description?: string

  @IsOptional() @IsInt() parentId?: number

  @IsOptional() @IsInt() position?: number

  @IsOptional() @IsIn(['template', 'rfp', 'ai_suggested']) source?: string
}
