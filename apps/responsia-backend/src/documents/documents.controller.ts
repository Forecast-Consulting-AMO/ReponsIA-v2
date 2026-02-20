import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiTags, ApiConsumes } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { DocumentsService } from './documents.service'
import { UploadDocumentDto } from './dto/upload-document.dto'

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Get('projects/:pid/documents')
  findAll(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
  ) {
    return this.documentsService.findAllByProject(pid, user.sub)
  }

  @Post('projects/:pid/documents')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  upload(
    @Param('pid', ParseIntPipe) pid: number,
    @CurrentUser() user: { sub: string },
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentsService.upload(pid, user.sub, file, dto.fileType)
  }

  @Delete('documents/:id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { sub: string },
  ) {
    await this.documentsService.remove(id, user.sub)
    return { success: true }
  }

  @Get('documents/:id/preview')
  getPreview(@Param('id', ParseIntPipe) id: number) {
    return this.documentsService.getPreview(id)
  }

  @Post('documents/:id/re-extract')
  reExtract(@Param('id', ParseIntPipe) id: number) {
    return this.documentsService.reExtract(id)
  }
}
