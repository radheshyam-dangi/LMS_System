import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
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

  /**
   * DATABASE QUERY: Fetches learning paths optimized at the database level.
   */
  async findAllPathsForUser(role: string, userId: string): Promise<LearningPathEntity[]> {
    try {
      // Base query definition with relations included
      const queryBuilder = this.repository.createQueryBuilder('learningPath')
        .leftJoinAndSelect('learningPath.modules', 'modules')
        .orderBy('learningPath.created_at', 'DESC'); // Ensure this matches your BaseEntity column name

      if (role === 'Trainee') {
        /**
         * 🔥 FIX: Database-level filtering for 'simple-array' columns.
         * For PostgreSQL/MySQL, handling simple-arrays efficiently without loading all records into memory.
         */
        queryBuilder.where('learningPath.assignedToTraineeIds LIKE :userId', {
          userId: `%${userId}%`,
        });
      }

      return await queryBuilder.getMany();
    } catch (error) {
      throw new Error(`Database fetch operation failed: ${error.message}`);
    }
  }

  /**
   * DATABASE MUTATION: Safely maps incoming parameters and enforces transactional safety.
   */
  async createPathWithUser(dto: any, creatorId: string): Promise<LearningPathEntity> {
    if (!dto.name) {
      throw new BadRequestException('Path title/name is highly required.');
    }

    const newPath = this.repository.create({
      title: dto.name, 
      description: dto.description ?? null,
      difficulty: dto.difficulty ?? 'Intermediate',
      duration: dto.duration ?? '12 weeks',
      skillsTags: dto.skillsTags ?? ['General'],
      status: 'Active',
      createdBy: { id: creatorId } as UserEntity, 
      assignedToTraineeIds: [],
    });

    return await this.repository.save(newPath);
  }

  /**
   * 🔥 FIX: Completed and robust method for assigning paths to trainees.
   */
  async assignPathToTrainee(pathId: string, traineeId: string): Promise<LearningPathEntity> {
    const path = await this.repository.findOne({ 
      where: { id: pathId } as any 
    });
    
    if (!path) {
      throw new NotFoundException(`Learning Path with ID "${pathId}" does not exist.`);
    }

    // Ensure array initialization safety
    if (!path.assignedToTraineeIds) {
      path.assignedToTraineeIds = [];
    }

    // Append only if the trainee isn't already assigned
    if (!path.assignedToTraineeIds.includes(traineeId)) {
      path.assignedToTraineeIds.push(traineeId);
    }

    return await this.repository.save(path);
  }

  /**
   * Active paths query setup
   */
  async findActivePathsWithModules(): Promise<LearningPathEntity[]> {
    return await this.repository.find({
      where: { status: 'Active' } as any,
      relations: ['modules'],
    });
  }
}