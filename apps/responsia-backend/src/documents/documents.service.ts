import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { ConfigService } from '@nestjs/config'
import { Repository } from 'typeorm'
import { Document } from '../database/entities/document.entity'
import { StorageService } from '../storage/storage.service'
import { ProjectsService } from '../projects/projects.service'
import { readPdf } from './processing/pdf-reader'
import { readDocx } from './processing/docx-reader'
import { readXlsx } from './processing/xlsx-reader'

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name)

  constructor(
    @InjectRepository(Document)
    private documentsRepo: Repository<Document>,
    private storageService: StorageService,
    private projectsService: ProjectsService,
    private config: ConfigService,
  ) {}

  async findAllByProject(
    projectId: number,
    auth0Id: string,
  ): Promise<Document[]> {
    await this.projectsService.verifyAccess(projectId, auth0Id)
    return this.documentsRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    })
  }

  async findOne(id: number): Promise<Document> {
    const doc = await this.documentsRepo.findOne({ where: { id } })
    if (!doc) throw new NotFoundException('Document non trouvé')
    return doc
  }

  async upload(
    projectId: number,
    auth0Id: string,
    file: Express.Multer.File,
    fileType: string,
  ): Promise<Document> {
    await this.projectsService.verifyAccess(projectId, auth0Id, 'editor')

    const blobName = `projects/${projectId}/documents/${Date.now()}-${file.originalname}`
    await this.storageService.upload(blobName, file.buffer, file.mimetype)

    // Extract text from the file
    const { text, pages, ocrUsed } = await this.extractText(
      file.buffer,
      file.mimetype,
      file.originalname,
    )

    const doc = this.documentsRepo.create({
      projectId,
      filename: file.originalname,
      fileType,
      mimeType: file.mimetype,
      blobName,
      extractedText: text,
      pageCount: pages ?? 0,
      ocrUsed: ocrUsed ?? false,
    })

    return this.documentsRepo.save(doc)
  }

  async remove(id: number, auth0Id: string): Promise<void> {
    const doc = await this.findOne(id)
    await this.projectsService.verifyAccess(doc.projectId, auth0Id, 'editor')
    await this.storageService.delete(doc.blobName)
    await this.documentsRepo.remove(doc)
  }

  async getPreview(id: number): Promise<{ text: string; pageCount: number }> {
    const doc = await this.findOne(id)
    return {
      text: doc.extractedText || '',
      pageCount: doc.pageCount || 0,
    }
  }

  async reExtract(id: number): Promise<Document> {
    const doc = await this.findOne(id)
    const buffer = await this.storageService.download(doc.blobName)
    const { text, pages } = await this.extractText(
      buffer,
      doc.mimeType,
      doc.filename,
    )
    doc.extractedText = text
    if (pages !== undefined) doc.pageCount = pages
    return this.documentsRepo.save(doc)
  }

  private async extractText(
    buffer: Buffer,
    mimeType: string,
    filename: string,
  ): Promise<{ text: string; pages?: number; ocrUsed?: boolean }> {
    const ext = filename.split('.').pop()?.toLowerCase()

    try {
      if (mimeType === 'application/pdf' || ext === 'pdf') {
        return readPdf(
          buffer,
          this.config.get('AZURE_DI_ENDPOINT'),
          this.config.get('AZURE_DI_KEY'),
        )
      }

      if (
        mimeType ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        ext === 'docx'
      ) {
        return readDocx(buffer)
      }

      if (
        mimeType ===
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        ext === 'xlsx' ||
        ext === 'xls'
      ) {
        const result = await readXlsx(buffer)
        return { text: result.text }
      }

      // Plain text fallback
      if (mimeType.startsWith('text/') || ext === 'txt' || ext === 'csv') {
        return { text: buffer.toString('utf-8') }
      }

      throw new BadRequestException(`Type de fichier non supporté: ${mimeType}`)
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      this.logger.error(`Text extraction failed: ${error}`)
      return { text: '' }
    }
  }
}
