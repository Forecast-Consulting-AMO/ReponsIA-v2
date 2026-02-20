import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import type { Project } from './project.entity'

@Entity('project_members')
export class ProjectMember {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'project_id' })
  projectId: number

  @ManyToOne('Project', 'members', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project

  @Column({ name: 'auth0_id', nullable: true })
  auth0Id: string

  @Column()
  email: string

  @Column({ type: 'varchar', default: 'editor' })
  role: 'owner' | 'editor' | 'viewer'

  @CreateDateColumn({ name: 'invited_at' })
  invitedAt: Date

  @Column({ name: 'accepted_at', type: 'timestamp', nullable: true })
  acceptedAt: Date
}
