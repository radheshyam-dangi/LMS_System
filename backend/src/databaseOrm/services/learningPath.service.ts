import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
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
async createPathWithUser(dto: any, creatorId: string): Promise<LearningPathEntity> {
    if (!dto.name && !dto.title) {
      throw new BadRequestException('Path title/name is required.');
    }

    // 1. Verify that the user executing this action exists in the DB
    const existingUser = await this.repository.findOne({ where: { id: creatorId } });

    if (!existingUser) {
      throw new BadRequestException(
        `Session Invalid: User with ID "${creatorId}" does not exist in database. Please log out and log in again.`
      );
    }

    // 2. Create the learning path with the verified user
    const newPath = this.repository.create({
      title: dto.name || dto.title,
      description: dto.description ?? null,
      difficulty: dto.difficulty ?? 'Intermediate',
      duration: dto.duration ?? '12 weeks',
      skillsTags: dto.skillsTags ?? ['General'],
      status: 'Active',
      createdBy: existingUser, // 👈 Assign real entity
      assignedToTraineeIds: [],
    });

    const savedPath = await this.repository.save(newPath);

    const fullPathDetails = await this.repository.findOne({
      where: { id: savedPath.id },
      relations: ['modules', 'createdBy'],
    });

    if (!fullPathDetails) {
      throw new InternalServerErrorException('Failed to retrieve created learning path details.');
    }

    return fullPathDetails;
  }

  async findPathWithDetails(id: string): Promise<LearningPathEntity> {
    const path = await this.repository.findOne({
      where: { id },
      relations: ['createdBy', 'modules'],
    });
    if (!path) {
      throw new NotFoundException(`Learning Path with ID "${id}" not found.`);
    }
    return path;
  }

  async assignPathToTrainee(pathId: string, traineeId: string): Promise<LearningPathEntity> {
    const path = await this.repository.findOne({ 
      where: { id: pathId },
      relations: ['modules', 'createdBy']
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
  async deletePath(pathId: string, userId: string, role: string): Promise<{ message: string }> {
    const path = await this.repository.findOne({
      where: { id: pathId },
      relations: ['createdBy'],
    });

    if (!path) {
      throw new NotFoundException(`Learning Path with ID "${pathId}" not found.`);
    }

    // 🔒 Authorization Check: Must be Admin OR Creator of this Learning Path
    const isOwner = path.createdBy?.id === userId;
    const isAdmin = role.toLowerCase() === 'admin';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Forbidden: Only the creator of this Learning Path or an Admin can delete it.');
    }

    // Deleting the Learning Path record automatically unassigns it from all trainees
    await this.repository.remove(path);

    return { message: 'Learning Path and all associated content successfully deleted.' };
  }
}