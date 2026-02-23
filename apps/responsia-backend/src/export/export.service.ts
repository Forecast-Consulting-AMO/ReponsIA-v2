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
import { OutlineSection } from '../database/entities/outline-section.entity'
import { DraftGroup } from '../database/entities/draft-group.entity'
import { ExtractedItem } from '../database/entities/extracted-item.entity'
import { Project } from '../database/entities/project.entity'
import { Document as DocumentEntity } from '../database/entities/document.entity'
import { ProjectsService } from '../projects/projects.service'
import { StorageService } from '../storage/storage.service'

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name)

  constructor(
    @InjectRepository(OutlineSection)
    private sectionRepo: Repository<OutlineSection>,
    @InjectRepository(DraftGroup)
    private groupRepo: Repository<DraftGroup>,
    @InjectRepository(ExtractedItem)
    private itemRepo: Repository<ExtractedItem>,
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
    const sections = await this.sectionRepo.find({
      where: { projectId },
      order: { position: 'ASC' },
    })
    const groups = await this.groupRepo.find({ where: { projectId } })
    const items = await this.itemRepo.find({ where: { projectId } })

    // Map groups by outlineSectionId for quick lookup
    const groupBySection = new Map<number, DraftGroup>()
    for (const g of groups) {
      groupBySection.set(g.outlineSectionId, g)
    }

    // Map items by outlineSectionId
    const itemsBySection = new Map<number, ExtractedItem[]>()
    for (const item of items) {
      if (item.outlineSectionId) {
        const arr = itemsBySection.get(item.outlineSectionId) || []
        arr.push(item)
        itemsBySection.set(item.outlineSectionId, arr)
      }
    }

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
            text: `Genere le ${new Date().toLocaleDateString('fr-FR')}`,
            size: 20,
            color: '888888',
          }),
        ],
        spacing: { after: 600 },
      }),
    ]

    // Add each outline section
    for (const section of sections) {
      // Section header
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: section.title,
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400 },
        }),
      )

      if (section.description) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: section.description, italics: true, size: 20, color: '666666' }),
            ],
            spacing: { after: 200 },
          }),
        )
      }

      // Draft group response
      const group = groupBySection.get(section.id)
      if (group?.generatedText) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Reponse:', bold: true, size: 22 }),
            ],
            spacing: { before: 200 },
          }),
        )
        for (const para of group.generatedText.split('\n')) {
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
                text: '[Reponse non redigee]',
                italics: true,
                color: 'CC0000',
                size: 22,
              }),
            ],
          }),
        )
      }

      // Conditions checklist for this section
      const sectionItems = itemsBySection.get(section.id) || []
      const conditionItems = sectionItems.filter((i) => i.kind === 'condition')
      if (conditionItems.length > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Conditions:', bold: true, size: 22 }),
            ],
            spacing: { before: 200 },
          }),
        )
        for (const cond of conditionItems) {
          const check = cond.addressed ? '[x]' : '[ ]'
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${check} ${cond.originalText}`, size: 20 }),
              ],
              spacing: { after: 50 },
            }),
          )
        }
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
    const sections = await this.sectionRepo.find({
      where: { projectId },
      order: { position: 'ASC' },
    })
    const groups = await this.groupRepo.find({ where: { projectId } })

    const groupBySection = new Map<number, DraftGroup>()
    for (const g of groups) {
      groupBySection.set(g.outlineSectionId, g)
    }

    const templateDoc = await this.documentsRepo.findOne({
      where: { projectId, fileType: 'template' },
    })
    if (!templateDoc?.blobName) {
      throw new NotFoundException('Aucun modele Word importe pour ce projet')
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

    // Replace section-specific placeholders using outline section titles
    for (const section of sections) {
      const group = groupBySection.get(section.id)
      const key = `SECTION_${section.title.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`
      xml = xml.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        this.escapeXml(group?.generatedText || '[Non redige]'),
      )
    }

    // Replace {{SECTIONS_TABLE}} with a formatted list of all sections+responses
    const sectionsTable = sections
      .map((s) => {
        const group = groupBySection.get(s.id)
        return `${s.title}\n${group?.generatedText || '[Non redige]'}`
      })
      .join('\n\n')
    xml = xml.replace(/\{\{SECTIONS_TABLE\}\}/g, this.escapeXml(sectionsTable))

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
