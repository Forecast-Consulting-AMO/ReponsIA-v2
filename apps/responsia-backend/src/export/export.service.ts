import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx'
import { Requirement } from '../database/entities/requirement.entity'
import { Project } from '../database/entities/project.entity'
import { Document as DocumentEntity } from '../database/entities/document.entity'
import { ProjectsService } from '../projects/projects.service'
import { StorageService } from '../storage/storage.service'

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name)

  constructor(
    @InjectRepository(Requirement)
    private requirementsRepo: Repository<Requirement>,
    @InjectRepository(Project)
    private projectsRepo: Repository<Project>,
    @InjectRepository(DocumentEntity)
    private documentsRepo: Repository<DocumentEntity>,
    private projectsService: ProjectsService,
    private storageService: StorageService,
  ) {}

  /** Generate a clean structured DOCX export */
  async exportClean(
    projectId: number,
    auth0Id: string,
  ): Promise<Buffer> {
    await this.projectsService.verifyAccess(projectId, auth0Id)

    const project = await this.projectsRepo.findOneOrFail({ where: { id: projectId } })
    const requirements = await this.requirementsRepo.find({
      where: { projectId },
      order: { sectionNumber: 'ASC' },
    })

    const children: Paragraph[] = [
      // Title
      new Paragraph({
        children: [new TextRun({ text: project.name, bold: true, size: 48 })],
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: project.description || '',
            italics: true,
            size: 24,
          }),
        ],
        spacing: { after: 400 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Généré le ${new Date().toLocaleDateString('fr-FR')}`,
            size: 20,
            color: '888888',
          }),
        ],
        spacing: { after: 600 },
      }),
    ]

    // Add each requirement as a section
    for (const req of requirements) {
      // Section header
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${req.sectionNumber} — ${req.sectionTitle}`,
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400 },
        }),
      )

      // Requirement text
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Exigence: ', bold: true, size: 22 }),
            new TextRun({ text: req.requirementText, size: 22 }),
          ],
          spacing: { after: 200 },
        }),
      )

      // Type badge
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Type: ${req.requirementType}${req.maxScore ? ` (max ${req.maxScore} pts)` : ''}`,
              italics: true,
              size: 20,
              color: '666666',
            }),
          ],
        }),
      )

      // Response
      if (req.responseText) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Réponse:', bold: true, size: 22 }),
            ],
            spacing: { before: 200 },
          }),
        )
        // Split response into paragraphs
        for (const para of req.responseText.split('\n')) {
          if (para.trim()) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: para, size: 22 })],
                spacing: { after: 100 },
              }),
            )
          }
        }
      } else {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '[Réponse non rédigée]',
                italics: true,
                color: 'CC0000',
                size: 22,
              }),
            ],
          }),
        )
      }
    }

    const doc = new DocxDocument({
      sections: [{ children }],
    })

    return Buffer.from(await Packer.toBuffer(doc))
  }

  /** Generate a DOCX export based on an uploaded template with placeholder replacement */
  async exportTemplate(projectId: number, auth0Id: string): Promise<Buffer> {
    await this.projectsService.verifyAccess(projectId, auth0Id)

    const project = await this.projectsRepo.findOneOrFail({ where: { id: projectId } })
    const requirements = await this.requirementsRepo.find({
      where: { projectId },
      order: { sectionNumber: 'ASC' },
    })

    const templateDoc = await this.documentsRepo.findOne({
      where: { projectId, fileType: 'template' },
    })
    if (!templateDoc?.blobName) {
      throw new NotFoundException('Aucun modèle Word importé pour ce projet')
    }

    const templateBuffer = await this.storageService.download(templateDoc.blobName)

    // Simple placeholder replacement in the DOCX XML
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(templateBuffer)
    const xmlFile = zip.file('word/document.xml')
    if (!xmlFile) throw new Error('Invalid DOCX template')

    let xml = await xmlFile.async('string')

    // Replace known placeholders
    xml = xml.replace(/\{\{PROJECT_NAME\}\}/g, this.escapeXml(project.name))
    xml = xml.replace(/\{\{PROJECT_DESCRIPTION\}\}/g, this.escapeXml(project.description || ''))
    xml = xml.replace(/\{\{DATE\}\}/g, new Date().toLocaleDateString('fr-FR'))

    // Replace section-specific placeholders: {{SECTION_3_1_2}} etc.
    for (const req of requirements) {
      const key = `SECTION_${req.sectionNumber?.replace(/\./g, '_')}`
      xml = xml.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        this.escapeXml(req.responseText || '[Non rédigé]'),
      )
    }

    // Replace {{REQUIREMENTS_TABLE}} with a formatted list of all requirements+responses
    const reqTable = requirements
      .map((r) => `${r.sectionNumber} - ${r.sectionTitle}\n${r.responseText || '[Non rédigé]'}`)
      .join('\n\n')
    xml = xml.replace(/\{\{REQUIREMENTS_TABLE\}\}/g, this.escapeXml(reqTable))

    zip.file('word/document.xml', xml)
    const output = await zip.generateAsync({ type: 'nodebuffer' })
    return Buffer.from(output)
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }
}
