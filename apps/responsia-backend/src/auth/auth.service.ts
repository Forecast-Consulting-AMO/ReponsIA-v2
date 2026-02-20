import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Profile } from '../database/entities/profile.entity'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    @InjectRepository(Profile)
    private profileRepo: Repository<Profile>,
  ) {}

  async syncProfile(auth0Id: string, email: string): Promise<Profile> {
    let profile = await this.profileRepo.findOne({ where: { auth0Id } })
    if (!profile) {
      profile = this.profileRepo.create({
        auth0Id,
        email,
        displayName: email.split('@')[0],
      })
      profile = await this.profileRepo.save(profile)
      this.logger.log(`Created new profile for ${email}`)
    }
    return profile
  }

  async updateProfile(
    auth0Id: string,
    data: {
      displayName?: string
      agentInstructions?: string
      defaultModels?: Record<string, string>
      defaultPrompts?: Record<string, string>
    },
  ): Promise<Profile> {
    await this.profileRepo.update(auth0Id, data)
    return this.profileRepo.findOneOrFail({ where: { auth0Id } })
  }

  async getProfile(auth0Id: string): Promise<Profile | null> {
    return this.profileRepo.findOne({ where: { auth0Id } })
  }
}
