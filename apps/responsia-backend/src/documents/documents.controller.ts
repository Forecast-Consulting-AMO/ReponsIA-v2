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
  UploadedFiles,
  Body,
} from '@nestjs/common'
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express'
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

  /** Classify documents into types using LLM (filename + content excerpt) */
  @Post('documents/classify')
  @UseInterceptors(FilesInterceptor('files', 20))
  @ApiConsumes('multipart/form-data')
  async classifyDocTypes(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<{ classifications: Record<string, string> }> {
    if (!files?.length) return { classifications: {} }

    const EXCERPT_LENGTH = 1000

    // Extract text excerpts from each file in parallel
    const excerpts = await Promise.all(
      files.map(async (file) => {
        try {
          const { text } = await this.documentsService.extractText(
            file.buffer,
            file.mimetype,
            file.originalname,
          )
          return {
            filename: file.originalname,
            excerpt: (text || '').slice(0, EXCERPT_LENGTH).trim(),
          }
        } catch {
          return { filename: file.originalname, excerpt: '' }
        }
      }),
    )

    const filenames = excerpts.map((e) => e.filename)

    const fileDescriptions = excerpts
      .map(
        (e, i) =>
          `${i + 1}. Fichier: "${e.filename}"${e.excerpt ? `\n   Extrait du contenu: "${e.excerpt}"` : '\n   (contenu non lisible)'}`,
      )
      .join('\n\n')

    const prompt = `Vous classifiez des documents pour un appel d'offres (RFP).
Pour chaque document, analysez le nom de fichier ET l'extrait du contenu pour déterminer son type parmi ces catégories:
- rfp: Document d'appel d'offres, cahier des charges, règlement de consultation, CCTP, CCAP, RC
- past_submission: Soumission précédente, offre antérieure, proposition passée, mémoire technique soumis
- reference: Document de référence, certificat, attestation, CV, organigramme, fiche technique
- analysis_report: Rapport d'analyse, évaluation, grille de notation, retour d'expérience, bilan
- template: Modèle Word, template de réponse, document avec des champs à remplir

Documents à classifier:
${fileDescriptions}

Répondez UNIQUEMENT avec un tableau JSON. Chaque élément: {"filename": "...", "type": "..."}.
Ne retournez QUE le JSON, sans texte supplémentaire.`

    try {
      const model = this.aiService.resolveModel('analysis')
      const result = await this.aiService.generate(model, 'Vous êtes un classificateur de documents expert en appels d\'offres.', prompt)

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
