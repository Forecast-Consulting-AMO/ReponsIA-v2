import { IsIn } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class UploadDocumentDto {
  @ApiProperty({
    enum: ['rfp', 'past_submission', 'reference', 'analysis_report', 'template'],
    description: 'Document classification type',
  })
  @IsIn(['rfp', 'past_submission', 'reference', 'analysis_report', 'template'])
  fileType: string
}
