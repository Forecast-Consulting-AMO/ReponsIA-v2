import { IsArray, ValidateNested, IsInt, IsOptional } from 'class-validator'
import { Type } from 'class-transformer'

class SectionOrder {
  @IsInt() id: number

  @IsInt() position: number

  @IsOptional() @IsInt() parentId?: number
}

export class ReorderSectionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionOrder)
  sections: SectionOrder[]
}
