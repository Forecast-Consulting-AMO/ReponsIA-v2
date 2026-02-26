import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Project } from '../database/entities/project.entity'
import { ProjectMember } from '../database/entities/project-member.entity'
import { CreateProjectDto } from './dto/create-project.dto'
import { UpdateProjectDto } from './dto/update-project.dto'
import { InviteMemberDto } from './dto/invite-member.dto'

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private projectsRepo: Repository<Project>,
    @InjectRepository(ProjectMember)
    private membersRepo: Repository<ProjectMember>,
  ) {}

  /** List projects owned by or shared with the user */
  async findAll(auth0Id: string): Promise<Project[]> {
    // Projects the user owns
    const owned = await this.projectsRepo.find({
      where: { auth0Id },
      order: { updatedAt: 'DESC' },
    })

    // Projects shared with the user via membership
    const memberships = await this.membersRepo.find({
      where: { auth0Id },
    })
    const sharedIds = memberships.map((m) => m.projectId)
    let shared: Project[] = []
    if (sharedIds.length > 0) {
      shared = await this.projectsRepo
        .createQueryBuilder('p')
        .where('p.id IN (:...ids)', { ids: sharedIds })
        .orderBy('p.updatedAt', 'DESC')
        .getMany()
    }

    // Merge and deduplicate
    const seen = new Set(owned.map((p) => p.id))
    for (const p of shared) {
      if (!seen.has(p.id)) {
        owned.push(p)
        seen.add(p.id)
      }
    }
    return owned
  }

  async findOne(id: number, auth0Id: string): Promise<Project> {
    await this.verifyAccess(id, auth0Id)
    const project = await this.projectsRepo.findOne({
      where: { id },
      relations: ['documents', 'feedback', 'members'],
    })
    if (!project) throw new NotFoundException('Projet non trouvé')
    return project
  }

  async create(auth0Id: string, dto: CreateProjectDto): Promise<Project> {
    const project = this.projectsRepo.create({
      ...dto,
      auth0Id,
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
    })
    const saved = await this.projectsRepo.save(project)

    // Add creator as owner member
    const member = this.membersRepo.create({
      projectId: saved.id,
      auth0Id,
      email: '', // filled on sync
      role: 'owner',
      acceptedAt: new Date(),
    })
    await this.membersRepo.save(member)

    return saved
  }

  async update(
    id: number,
    auth0Id: string,
    dto: UpdateProjectDto,
  ): Promise<Project> {
    await this.verifyAccess(id, auth0Id, 'editor')
    const project = await this.projectsRepo.findOneOrFail({ where: { id } })
    Object.assign(project, {
      ...dto,
      deadline: dto.deadline ? new Date(dto.deadline) : project.deadline,
    })
    return this.projectsRepo.save(project)
  }

  async remove(id: number, auth0Id: string): Promise<void> {
    await this.verifyAccess(id, auth0Id, 'owner')
    const project = await this.projectsRepo.findOneOrFail({ where: { id } })
    await this.projectsRepo.remove(project)
  }

  // --- Members ---

  async getMembers(projectId: number, auth0Id: string): Promise<ProjectMember[]> {
    await this.verifyAccess(projectId, auth0Id)
    return this.membersRepo.find({
      where: { projectId },
      order: { invitedAt: 'ASC' },
    })
  }

  async inviteMember(
    projectId: number,
    auth0Id: string,
    dto: InviteMemberDto,
  ): Promise<ProjectMember> {
    await this.verifyAccess(projectId, auth0Id, 'owner')

    // Check if already invited
    const existing = await this.membersRepo.findOne({
      where: { projectId, email: dto.email },
    })
    if (existing) {
      existing.role = dto.role
      return this.membersRepo.save(existing)
    }

    const member = this.membersRepo.create({
      projectId,
      email: dto.email,
      role: dto.role,
    })
    return this.membersRepo.save(member)
  }

  async removeMember(
    projectId: number,
    memberId: number,
    auth0Id: string,
  ): Promise<void> {
    await this.verifyAccess(projectId, auth0Id, 'owner')
    const member = await this.membersRepo.findOne({
      where: { id: memberId, projectId },
    })
    if (!member) throw new NotFoundException('Membre non trouvé')
    if (member.role === 'owner') {
      throw new ForbiddenException('Cannot remove the project owner')
    }
    await this.membersRepo.remove(member)
  }

  // --- Access control ---

  async verifyAccess(
    projectId: number,
    auth0Id: string,
    requiredRole?: 'owner' | 'editor' | 'viewer',
  ): Promise<void> {
    // Check if owner
    const project = await this.projectsRepo.findOne({
      where: { id: projectId },
    })
    if (!project) throw new NotFoundException('Projet non trouvé')

    if (project.auth0Id === auth0Id) return // Owner always has access

    // Check membership
    const member = await this.membersRepo.findOne({
      where: { projectId, auth0Id },
    })
    if (!member) {
      throw new ForbiddenException('Accès refusé à ce projet')
    }

    if (requiredRole === 'owner') {
      throw new ForbiddenException('Seul le propriétaire peut effectuer cette action')
    }
    if (requiredRole === 'editor' && member.role === 'viewer') {
      throw new ForbiddenException('Accès en lecture seule')
    }
  }
}
