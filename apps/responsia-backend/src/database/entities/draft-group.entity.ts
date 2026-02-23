import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm'
import type { Project } from './project.entity'
import type { OutlineSection } from './outline-section.entity'

@Entity('draft_groups')
export class DraftGroup {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'project_id' })
  projectId: number

  @ManyToOne('Project', 'draftGroups', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project

  @Column({ name: 'outline_section_id', unique: true })
  outlineSectionId: number

  @OneToOne('OutlineSection')
  @JoinColumn({ name: 'outline_section_id' })
  outlineSection: OutlineSection

  @Column({ name: 'model_id', type: 'varchar', default: 'claude-sonnet-4.6' })
  modelId: string

  @Column({ name: 'system_prompt', type: 'text', default: '' })
  systemPrompt: string

  @Column({ name: 'generated_text', type: 'text', nullable: true })
  generatedText: string | null

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'generating' | 'drafted' | 'edited' | 'final'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
