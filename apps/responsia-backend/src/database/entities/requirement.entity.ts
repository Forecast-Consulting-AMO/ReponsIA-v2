import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import type { Project } from './project.entity'

@Entity('requirements')
export class Requirement {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'project_id' })
  projectId: number

  @ManyToOne('Project', 'requirements', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project

  @Column({ name: 'section_number', nullable: true })
  sectionNumber: string

  @Column({ name: 'section_title', nullable: true })
  sectionTitle: string

  @Column({ name: 'requirement_text', type: 'text' })
  requirementText: string

  @Column({ name: 'requirement_type', type: 'varchar', default: 'mandatory' })
  requirementType: 'mandatory' | 'optional' | 'scored'

  @Column({ name: 'max_score', type: 'int', nullable: true })
  maxScore: number

  @Column({ name: 'response_status', type: 'varchar', default: 'pending' })
  responseStatus: 'pending' | 'drafted' | 'reviewed' | 'final'

  @Column({ name: 'response_text', type: 'text', nullable: true })
  responseText: string

  @Column({ name: 'source_document_id', nullable: true })
  sourceDocumentId: number

  @Column({ name: 'source_page', nullable: true })
  sourcePage: number

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
