import { Injectable, Logger } from '@nestjs/common'
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
import { ProjectsService } from '../projects/projects.service'

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name)

  constructor(
    @InjectRepository(Requirement)
    private requirementsRepo: Repository<Requirement>,
    @InjectRepository(Project)
    private projectsRepo: Repository<Project>,
    private projectsService: ProjectsService,
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
}
