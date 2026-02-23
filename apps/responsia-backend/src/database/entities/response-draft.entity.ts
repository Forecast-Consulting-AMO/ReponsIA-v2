import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import type { DraftGroup } from './draft-group.entity'

@Entity('response_drafts')
export class ResponseDraft {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'draft_group_id' })
  draftGroupId: number

  @ManyToOne('DraftGroup', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'draft_group_id' })
  draftGroup: DraftGroup

  @Column({ type: 'int' })
  version: number

  @Column({ type: 'text' })
  content: string

  @Column({ name: 'model_used', type: 'varchar' })
  modelUsed: string

  @Column({ name: 'prompt_used', type: 'text' })
  promptUsed: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
