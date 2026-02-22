import { IsString, IsInt } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  message: string
}

export class EditSuggestionDto {
  @ApiProperty({ description: 'ID of the requirement to edit' })
  @IsInt()
  requirementId: number

  @ApiProperty({ description: 'Edit instruction, e.g. "make it more concise"' })
  @IsString()
  instruction: string
}
