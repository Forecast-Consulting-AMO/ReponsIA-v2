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
import type { Project } from './project.entity'

@Entity('outline_sections')
export class OutlineSection {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'project_id' })
  projectId: number

  @ManyToOne('Project', 'outlineSections', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project

  @Column({ name: 'parent_id', nullable: true })
  parentId: number | null

  @ManyToOne('OutlineSection', 'children', {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parent: OutlineSection | null

  @OneToMany('OutlineSection', 'parent')
  children: OutlineSection[]

  @Column({ type: 'int', default: 0 })
  position: number

  @Column()
  title: string

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'varchar', default: 'ai_suggested' })
  source: 'template' | 'rfp' | 'ai_suggested'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
