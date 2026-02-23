import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import type { Project } from './project.entity'

@Entity('job_progress')
export class JobProgress {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'project_id' })
  projectId: number

  @ManyToOne('Project', 'jobs', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project

  @Column({ name: 'job_type', type: 'varchar' })
  jobType: 'analysis' | 'indexing' | 'feedback' | 'draft_all' | 'setup' | 'structure' | 'extraction'

  @Column({ type: 'varchar', default: 'queued' })
  status: 'queued' | 'processing' | 'completed' | 'error'

  @Column({ type: 'int', default: 0 })
  progress: number

  @Column({ type: 'text', nullable: true })
  message: string

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string
}
