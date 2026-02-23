import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import type { Project } from './project.entity'

@Entity('document_chunks')
export class DocumentChunk {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'project_id' })
  projectId: number

  @ManyToOne('Project', 'chunks', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project

  @Column({ name: 'document_id' })
  documentId: number

  @Column({ type: 'text' })
  content: string

  @Column({ name: 'section_title', type: 'varchar', nullable: true })
  sectionTitle: string

  @Column({ name: 'start_char', type: 'int', nullable: true })
  startChar: number

  @Column({ name: 'end_char', type: 'int', nullable: true })
  endChar: number

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  // NOTE: embedding (vector(1536)) and search_vector (tsvector)
  // are managed via raw SQL in DatabaseModule.onApplicationBootstrap
}
