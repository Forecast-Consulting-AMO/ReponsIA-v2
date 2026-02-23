import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ExtractedItem } from '../database/entities/extracted-item.entity'
import { DraftGroup } from '../database/entities/draft-group.entity'
import { AnalysisFeedback } from '../database/entities/feedback.entity'
import { AiService } from '../ai/ai.service'
import { ProjectsService } from '../projects/projects.service'

export interface ComplianceReport {
  qualityScore: number
  coveragePercent: number
  summary: string
  warnings: { extractedItemId: number | null; message: string; severity: string }[]
  stats: {
    totalItems: number
    questions: number
    conditions: number
    addressedItems: number
    pendingItems: number
    draftGroupsTotal: number
    draftGroupsDrafted: number
    feedbackAddressed: number
    feedbackTotal: number
  }
}

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name)

  constructor(
    @InjectRepository(ExtractedItem)
    private itemRepo: Repository<ExtractedItem>,
    @InjectRepository(DraftGroup)
    private groupRepo: Repository<DraftGroup>,
    @InjectRepository(AnalysisFeedback)
    private feedbackRepo: Repository<AnalysisFeedback>,
    private aiService: AiService,
    private projectsService: ProjectsService,
  ) {}

  async generateReport(
    projectId: number,
    auth0Id: string,
  ): Promise<ComplianceReport> {
    await this.projectsService.verifyAccess(projectId, auth0Id)

    const items = await this.itemRepo.find({ where: { projectId } })
    const groups = await this.groupRepo.find({ where: { projectId } })
    const feedback = await this.feedbackRepo.find({ where: { projectId } })

    const totalItems = items.length
    const questions = items.filter((i) => i.kind === 'question').length
    const conditions = items.filter((i) => i.kind === 'condition').length
    const addressedItems = items.filter((i) => i.addressed).length
    const pendingItems = totalItems - addressedItems

    const draftGroupsTotal = groups.length
    const draftGroupsDrafted = groups.filter(
      (g) => g.status !== 'pending' && g.status !== 'generating',
    ).length

    const feedbackAddressed = feedback.filter((f) => f.addressed).length

    const coveragePercent =
      totalItems > 0 ? Math.round((addressedItems / totalItems) * 100) : 0

    // Build warnings
    const warnings: ComplianceReport['warnings'] = []

    // Warn about unaddressed questions
    for (const item of items) {
      if (item.kind === 'question' && !item.addressed) {
        warnings.push({
          extractedItemId: item.id,
          message: `Question non traitee: ${item.sectionReference || ''} ${item.originalText.substring(0, 100)}`,
          severity: 'critical',
        })
      }
    }

    // Warn about unaddressed conditions
    for (const item of items) {
      if (item.kind === 'condition' && !item.addressed) {
        warnings.push({
          extractedItemId: item.id,
          message: `Condition non verifiee: ${item.originalText.substring(0, 100)}`,
          severity: 'major',
        })
      }
    }

    // Warn about unaddressed critical feedback
    for (const fb of feedback) {
      if (!fb.addressed && (fb.severity === 'critical' || fb.severity === 'major')) {
        warnings.push({
          extractedItemId: fb.extractedItemId,
          message: `Retour ${fb.severity} non adresse: ${fb.content.substring(0, 100)}...`,
          severity: fb.severity,
        })
      }
    }

    // Warn about draft groups still pending
    for (const group of groups) {
      if (group.status === 'pending') {
        warnings.push({
          extractedItemId: null,
          message: `Section non redigee (draft group #${group.id})`,
          severity: 'major',
        })
      }
    }

    // Use AI for quality assessment if enough items exist
    let qualityScore = coveragePercent
    let summary = `${addressedItems}/${totalItems} elements traites (${coveragePercent}% couverture), ${draftGroupsDrafted}/${draftGroupsTotal} sections redigees`

    if (addressedItems > 0) {
      try {
        const model = this.aiService.resolveModel('compliance')
        const systemPrompt = this.aiService.resolvePrompt('compliance')

        const itemsSummary = items
          .map((i) => `[${i.kind}] ${i.sectionReference || '?'}: ${i.originalText.substring(0, 200)} (${i.addressed ? 'traite' : 'en attente'})`)
          .join('\n')

        const response = await this.aiService.generate(
          model,
          systemPrompt,
          `Elements extraits:\n${itemsSummary}\n\nRetours:\n${feedback.map((f) => `[${f.feedbackType}/${f.severity}] ${f.content}`).join('\n')}`,
        )

        try {
          const parsed = JSON.parse(response)
          qualityScore = parsed.qualityScore ?? qualityScore
          summary = parsed.summary ?? summary
          if (parsed.warnings) {
            warnings.push(...parsed.warnings)
          }
        } catch {
          // AI response not parseable, use calculated values
        }
      } catch (err) {
        this.logger.warn(`AI compliance check failed: ${err}`)
      }
    }

    return {
      qualityScore,
      coveragePercent,
      summary,
      warnings,
      stats: {
        totalItems,
        questions,
        conditions,
        addressedItems,
        pendingItems,
        draftGroupsTotal,
        draftGroupsDrafted,
        feedbackAddressed,
        feedbackTotal: feedback.length,
      },
    }
  }
}
