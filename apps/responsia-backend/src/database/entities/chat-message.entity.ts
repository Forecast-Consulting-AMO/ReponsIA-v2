import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import type { Project } from './project.entity'

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'project_id' })
  projectId: number

  @ManyToOne('Project', 'chatMessages', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project

  @Column({ name: 'auth0_id' })
  auth0Id: string

  @Column({ type: 'varchar' })
  role: 'user' | 'assistant'

  @Column({ type: 'text' })
  content: string

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, unknown>

  @Column({ name: 'edit_target_item_id', type: 'int', nullable: true })
  editTargetItemId: number

  @Column({ name: 'edit_diff', type: 'jsonb', nullable: true })
  editDiff: { old: string; new: string }

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
