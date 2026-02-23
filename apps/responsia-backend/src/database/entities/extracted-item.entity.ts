import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import type { Project } from './project.entity'
import type { OutlineSection } from './outline-section.entity'

@Entity('extracted_items')
export class ExtractedItem {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'project_id' })
  projectId: number

  @ManyToOne('Project', 'extractedItems', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project

  @Column({ name: 'outline_section_id', nullable: true })
  outlineSectionId: number | null

  @ManyToOne('OutlineSection', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'outline_section_id' })
  outlineSection: OutlineSection | null

  @Column({ type: 'varchar', default: 'question' })
  kind: 'question' | 'condition'

  @Column({ name: 'original_text', type: 'text' })
  originalText: string

  @Column({ name: 'section_reference', nullable: true })
  sectionReference: string | null

  @Column({ name: 'source_document_id', nullable: true })
  sourceDocumentId: number | null

  @Column({ name: 'source_page', nullable: true })
  sourcePage: number | null

  @Column({ name: 'ai_themes', type: 'text', array: true, default: '{}' })
  aiThemes: string[]

  @Column({ default: false })
  addressed: boolean

  @Column({ name: 'response_text', type: 'text', nullable: true })
  responseText: string | null

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'drafted' | 'reviewed' | 'final'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
