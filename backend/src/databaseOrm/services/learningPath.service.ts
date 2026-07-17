import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { LearningPathEntity } from '../entities/learningPath.entity';
import { UserEntity } from '../entities/user.entity';

@Injectable()
export class LearningPathEntityService extends BaseService<LearningPathEntity> {
  protected repository: Repository<LearningPathEntity>;

  constructor(private readonly datasource: DataSource) {
    super();
    this.repository = this.datasource.getRepository<LearningPathEntity>(LearningPathEntity);
  }

  async findAllPathsForUser(role: string, userId: string): Promise<LearningPathEntity[]> {
    try {
      const queryBuilder = this.repository.createQueryBuilder('learningPath')
        .leftJoinAndSelect('learningPath.modules', 'modules')
        .leftJoinAndSelect('learningPath.createdBy', 'createdBy')
        .orderBy('learningPath.created_at', 'DESC'); 

      if (role === 'Trainee') {
        queryBuilder.where(
          '(learningPath.assignedToTraineeIds = :rawId OR learningPath.assignedToTraineeIds LIKE :leadingId OR learningPath.assignedToTraineeIds LIKE :trailingId OR learningPath.assignedToTraineeIds LIKE :innerId)',
          {
            rawId: userId,
            leadingId: `${userId},%`,
            trailingId: `%,${userId}`,
            innerId: `%,${userId},%`,
          }
        );
      }

      return await queryBuilder.getMany();
    } catch (error: any) {
      throw new InternalServerErrorException(`Database fetch operation failed: ${error.message}`);
    }
  }

  /**
   * DATABASE MUTATION: Handles creation and auto-reloads complete profile data mapping properties
   */
  async createPathWithUser(dto: any, creatorId: string): Promise<LearningPathEntity> {
    if (!dto.name) {
      throw new BadRequestException('Path title/name is highly required.');
    }

    const creator = new UserEntity();
    creator.id = creatorId;

    const newPath = this.repository.create({
      title: dto.name, 
      description: dto.description ?? null,
      difficulty: dto.difficulty ?? 'Intermediate',
      duration: dto.duration ?? '12 weeks',
      skillsTags: dto.skillsTags ?? ['General'],
      status: 'Active',
      createdBy: creator, 
      assignedToTraineeIds: [], 
    });

    // 1. First save entity record safely inside table persistence
    const savedPath = await this.repository.save(newPath);

    // 🔥 FIX: Return object reload with complete user details logic injected
    // Isse bina page reload kiye instant frontend UI component lines active metadata draw kar lengi
    const fullPathDetails = await this.repository.findOne({
      where: { id: savedPath.id },
      relations: ['modules', 'createdBy']
    });

    if (!fullPathDetails) {
      throw new InternalServerErrorException('Transaction pipeline synchronization failure.');
    }

    return fullPathDetails;
  }

  async findActivePathsWithModules(): Promise<LearningPathEntity[]> {
    return await this.repository.find({
      where: { status: 'Active' },
      relations: ['modules', 'createdBy'], 
      order: { createdAt: 'DESC' } as any // Always display recently modified blue-prints first
    });
  }

  async assignPathToTrainee(pathId: string, traineeId: string): Promise<LearningPathEntity> {
    const path = await this.repository.findOne({ 
      where: { id: pathId },
      relations: ['modules', 'createdBy'] // Pull completely to shield transactional entities leakage
    });
    
    if (!path) {
      throw new NotFoundException(`Learning Path with ID "${pathId}" does not exist.`);
    }

    let currentTrainees: string[] = [];
    if (Array.isArray(path.assignedToTraineeIds)) {
      currentTrainees = path.assignedToTraineeIds;
    } else if (typeof path.assignedToTraineeIds === 'string') {
      currentTrainees = (path.assignedToTraineeIds as string).split(',').map(t => t.trim());
    }

    if (!currentTrainees.includes(traineeId)) {
      currentTrainees.push(traineeId);
    }

    path.assignedToTraineeIds = currentTrainees;
    return await this.repository.save(path);
  }
}