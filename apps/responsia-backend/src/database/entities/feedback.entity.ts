import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import type { Project } from './project.entity'

@Entity('analysis_feedback')
export class AnalysisFeedback {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'project_id' })
  projectId: number

  @ManyToOne('Project', 'feedback', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project

  @Column({ name: 'document_id', type: 'int', nullable: true })
  documentId: number

  @Column({ name: 'extracted_item_id', type: 'int', nullable: true })
  extractedItemId: number | null

  @Column({ name: 'section_reference', type: 'varchar', nullable: true })
  sectionReference: string

  @Column({ name: 'feedback_type', type: 'varchar' })
  feedbackType: 'strength' | 'weakness' | 'recommendation' | 'comment'

  @Column({ type: 'varchar', default: 'info' })
  severity: 'critical' | 'major' | 'minor' | 'info'

  @Column({ type: 'text' })
  content: string

  @Column({ default: false })
  addressed: boolean

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
