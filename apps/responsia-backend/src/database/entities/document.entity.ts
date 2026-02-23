import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import type { Project } from './project.entity'

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'project_id' })
  projectId: number

  @ManyToOne('Project', 'documents', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project

  @Column()
  filename: string

  @Column({ name: 'file_type' })
  fileType: string

  @Column({ name: 'mime_type' })
  mimeType: string

  @Column({ name: 'blob_name' })
  blobName: string

  @Column({ name: 'extracted_text', type: 'text', nullable: true })
  extractedText: string

  @Column({ name: 'parsed_structure', type: 'jsonb', nullable: true })
  parsedStructure: Record<string, unknown>

  @Column({ name: 'page_count', type: 'int', nullable: true })
  pageCount: number

  @Column({ name: 'ocr_used', default: false })
  ocrUsed: boolean

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
