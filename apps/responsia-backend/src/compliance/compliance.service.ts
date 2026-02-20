import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Requirement } from '../database/entities/requirement.entity'
import { AnalysisFeedback } from '../database/entities/feedback.entity'
import { AiService } from '../ai/ai.service'
import { ProjectsService } from '../projects/projects.service'

export interface ComplianceReport {
  qualityScore: number
  coveragePercent: number
  summary: string
  warnings: { requirementId: number | null; message: string; severity: string }[]
  stats: {
    total: number
    mandatory: number
    responded: number
    pending: number
    feedbackAddressed: number
    feedbackTotal: number
  }
}

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name)

  constructor(
    @InjectRepository(Requirement)
    private requirementsRepo: Repository<Requirement>,
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

    const requirements = await this.requirementsRepo.find({ where: { projectId } })
    const feedback = await this.feedbackRepo.find({ where: { projectId } })

    const total = requirements.length
    const mandatory = requirements.filter((r) => r.requirementType === 'mandatory').length
    const responded = requirements.filter((r) => r.responseStatus !== 'pending').length
    const pending = total - responded
    const feedbackAddressed = feedback.filter((f) => f.addressed).length

    const coveragePercent = total > 0 ? Math.round((responded / total) * 100) : 0

    // Build warnings
    const warnings: ComplianceReport['warnings'] = []

    // Warn about unanswered mandatory requirements
    for (const req of requirements) {
      if (req.requirementType === 'mandatory' && req.responseStatus === 'pending') {
        warnings.push({
          requirementId: req.id,
          message: `Exigence obligatoire non traitée: ${req.sectionNumber} ${req.sectionTitle}`,
          severity: 'critical',
        })
      }
    }

    // Warn about unaddressed critical feedback
    for (const fb of feedback) {
      if (!fb.addressed && (fb.severity === 'critical' || fb.severity === 'major')) {
        warnings.push({
          requirementId: fb.requirementId,
          message: `Retour ${fb.severity} non adressé: ${fb.content.substring(0, 100)}...`,
          severity: fb.severity,
        })
      }
    }

    // Use AI for quality assessment if enough responses exist
    let qualityScore = coveragePercent
    let summary = `${responded}/${total} exigences traitées (${coveragePercent}% couverture)`

    if (responded > 0) {
      try {
        const model = this.aiService.resolveModel('compliance')
        const systemPrompt = this.aiService.resolvePrompt('compliance')

        const requirementsSummary = requirements
          .map((r) => `[${r.sectionNumber}] ${r.requirementType}: ${r.responseStatus} - ${(r.responseText || '').substring(0, 200)}`)
          .join('\n')

        const response = await this.aiService.generate(
          model,
          systemPrompt,
          `Exigences et réponses:\n${requirementsSummary}\n\nRetours:\n${feedback.map((f) => `[${f.feedbackType}/${f.severity}] ${f.content}`).join('\n')}`,
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
        total,
        mandatory,
        responded,
        pending,
        feedbackAddressed,
        feedbackTotal: feedback.length,
      },
    }
  }
}
