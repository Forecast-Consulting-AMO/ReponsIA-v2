import { IsString, IsInt } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  message: string
}

export class EditSuggestionDto {
  @ApiProperty({ description: 'ID of the extracted item to edit' })
  @IsInt()
  itemId: number

  @ApiProperty({ description: 'Edit instruction, e.g. "make it more concise"' })
  @IsString()
  instruction: string
}
