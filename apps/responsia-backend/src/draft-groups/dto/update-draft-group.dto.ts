import { IsOptional, IsString, IsIn } from 'class-validator'

export class UpdateDraftGroupDto {
  @IsOptional()
  @IsString()
  modelId?: string

  @IsOptional()
  @IsString()
  systemPrompt?: string

  @IsOptional()
  @IsString()
  generatedText?: string

  @IsOptional()
  @IsIn(['pending', 'generating', 'drafted', 'edited', 'final'])
  status?: string
}
