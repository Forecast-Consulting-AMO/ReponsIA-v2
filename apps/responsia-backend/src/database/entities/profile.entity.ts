import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm'
import type { Project } from './project.entity'

@Entity('profiles')
export class Profile {
  @PrimaryColumn({ name: 'auth0_id' })
  auth0Id: string

  @Column()
  email: string

  @Column({ name: 'display_name', nullable: true })
  displayName: string

  @Column({ default: 'user' })
  role: string

  @Column({ name: 'agent_instructions', type: 'text', nullable: true })
  agentInstructions: string

  @Column({ name: 'default_models', type: 'jsonb', nullable: true })
  defaultModels: Record<string, string>

  @Column({ name: 'default_prompts', type: 'jsonb', nullable: true })
  defaultPrompts: Record<string, string>

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @OneToMany('Project', 'profile')
  projects: Project[]
}
