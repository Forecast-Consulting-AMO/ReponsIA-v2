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
import { AiService } from '../ai/ai.service'
import { DocumentsService } from './documents.service'
import { UploadDocumentDto } from './dto/upload-document.dto'

const VALID_FILE_TYPES = ['rfp', 'past_submission', 'reference', 'analysis_report', 'template'] as const

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DocumentsController {
  constructor(
    private documentsService: DocumentsService,
    private aiService: AiService,
  ) {}

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

  /** Classify filenames into document types using LLM */
  @Post('documents/classify')
  async classifyDocTypes(
    @Body() body: { filenames: string[] },
  ): Promise<{ classifications: Record<string, string> }> {
    const { filenames } = body
    if (!filenames?.length) return { classifications: {} }

    const prompt = `Vous classifiez des documents pour un appel d'offres (RFP).
Pour chaque nom de fichier, déterminez son type parmi ces catégories:
- rfp: Document d'appel d'offres, cahier des charges, règlement de consultation
- past_submission: Soumission précédente, offre antérieure, proposition passée
- reference: Document de référence, certificat, attestation, mémoire technique
- analysis_report: Rapport d'analyse, évaluation, grille de notation
- template: Modèle Word, template de réponse

Fichiers à classifier:
${filenames.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Répondez UNIQUEMENT avec un tableau JSON. Chaque élément: {"filename": "...", "type": "..."}.
Ne retournez QUE le JSON, sans texte supplémentaire.`

    try {
      const model = this.aiService.resolveModel('analysis')
      const result = await this.aiService.generate(model, 'Vous êtes un classificateur de documents.', prompt)

      // Extract JSON from response
      const jsonMatch = result.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        return { classifications: Object.fromEntries(filenames.map((f) => [f, 'other'])) }
      }

      const parsed = JSON.parse(jsonMatch[0]) as { filename: string; type: string }[]
      const classifications: Record<string, string> = {}
      for (const item of parsed) {
        const type = VALID_FILE_TYPES.includes(item.type as any) ? item.type : 'other'
        classifications[item.filename] = type
      }
      // Fill any missing filenames with 'other'
      for (const f of filenames) {
        if (!classifications[f]) classifications[f] = 'other'
      }
      return { classifications }
    } catch {
      return { classifications: Object.fromEntries(filenames.map((f) => [f, 'other'])) }
    }
  }
}
