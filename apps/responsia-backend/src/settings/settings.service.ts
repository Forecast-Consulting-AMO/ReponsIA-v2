import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Profile } from '../database/entities/profile.entity'
import { Project } from '../database/entities/project.entity'
import { AiService } from '../ai/ai.service'
import { AI_MODELS, DEFAULT_MODELS } from '../ai/ai.config'
import { PROMPTS } from '../ai/prompts'
import { ProjectsService } from '../projects/projects.service'

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Profile)
    private profileRepo: Repository<Profile>,
    @InjectRepository(Project)
    private projectsRepo: Repository<Project>,
    private aiService: AiService,
    private projectsService: ProjectsService,
  ) {}

  /** Get available AI models grouped by provider */
  getModels() {
    return {
      models: this.aiService.getAvailableModels(),
      defaults: DEFAULT_MODELS,
    }
  }

  /** Get user preferences (model assignments + custom prompts) */
  async getPreferences(auth0Id: string) {
    const profile = await this.profileRepo.findOne({ where: { auth0Id } })
    return {
      models: profile?.defaultModels ?? DEFAULT_MODELS,
      prompts: profile?.defaultPrompts ?? PROMPTS,
    }
  }

  /** Update user preferences */
  async updatePreferences(
    auth0Id: string,
    data: {
      models?: Record<string, string>
      prompts?: Record<string, string>
    },
  ) {
    await this.profileRepo.update(auth0Id, {
      defaultModels: data.models,
      defaultPrompts: data.prompts,
    })
    return this.getPreferences(auth0Id)
  }

  /** Get project-level settings overrides */
  async getProjectSettings(projectId: number, auth0Id: string) {
    await this.projectsService.verifyAccess(projectId, auth0Id)
    const project = await this.projectsRepo.findOneOrFail({ where: { id: projectId } })
    return {
      models: project.modelOverrides ?? {},
      prompts: project.promptOverrides ?? {},
      contentLanguage: project.contentLanguage,
    }
  }

  /** Update project-level settings overrides */
  async updateProjectSettings(
    projectId: number,
    auth0Id: string,
    data: {
      models?: Record<string, string>
      prompts?: Record<string, string>
      contentLanguage?: 'fr' | 'en' | 'nl'
    },
  ) {
    await this.projectsService.verifyAccess(projectId, auth0Id, 'owner')
    await this.projectsRepo.update(projectId, {
      modelOverrides: data.models,
      promptOverrides: data.prompts,
      contentLanguage: data.contentLanguage,
    })
    return this.getProjectSettings(projectId, auth0Id)
  }
}
