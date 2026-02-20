import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm'
import type { Profile } from './profile.entity'
import type { Document } from './document.entity'
import type { Requirement } from './requirement.entity'
import type { AnalysisFeedback } from './feedback.entity'
import type { ChatMessage } from './chat-message.entity'
import type { DocumentChunk } from './document-chunk.entity'
import type { ProjectMember } from './project-member.entity'
import type { JobProgress } from './job-progress.entity'

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'auth0_id' })
  auth0Id: string

  @ManyToOne('Profile', 'projects', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'auth0_id', referencedColumnName: 'auth0Id' })
  profile: Profile

  @Column()
  name: string

  @Column({ type: 'text', nullable: true })
  description: string

  @Column({ type: 'varchar', default: 'draft' })
  status: 'draft' | 'in_progress' | 'completed'

  @Column({ type: 'varchar', name: 'content_language', default: 'fr' })
  contentLanguage: 'fr' | 'en' | 'nl'

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date

  @Column({ type: 'jsonb', nullable: true })
  progress: Record<string, unknown>

  @Column({ name: 'model_overrides', type: 'jsonb', nullable: true })
  modelOverrides: Record<string, string>

  @Column({ name: 'prompt_overrides', type: 'jsonb', nullable: true })
  promptOverrides: Record<string, string>

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @OneToMany('Document', 'project')
  documents: Document[]

  @OneToMany('Requirement', 'project')
  requirements: Requirement[]

  @OneToMany('AnalysisFeedback', 'project')
  feedback: AnalysisFeedback[]

  @OneToMany('ChatMessage', 'project')
  chatMessages: ChatMessage[]

  @OneToMany('DocumentChunk', 'project')
  chunks: DocumentChunk[]

  @OneToMany('ProjectMember', 'project')
  members: ProjectMember[]

  @OneToMany('JobProgress', 'project')
  jobs: JobProgress[]
}
