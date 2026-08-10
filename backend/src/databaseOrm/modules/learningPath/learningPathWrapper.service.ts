import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { LearningPathEntityService } from './learningPath.service';
import { LearningPathEntity } from '../../entities/learningPath.entity';
@Injectable()
export class LearningPathService {
  constructor(
    private readonly learningPathEntityService: LearningPathEntityService
  ) {}

  /**
   * 1. GET PATHS FOR USER CONTEXT (Filtered by role / assigned IDs)
   */
  async getPathsForUserContext(role: string, userId: string): Promise<LearningPathEntity[]> {
    const allPaths = await this.learningPathEntityService.findAll();

    // Trainee filter: Only return paths assigned to this trainee
    if (role === 'Trainee') {
      return allPaths.filter((path) => path.assignedToTraineeIds?.includes(userId));
    }

    // Admins and Trainers can view all tracks
    return allPaths;
  }

  /**
   * 2. ASSIGN PATH TO TRAINEE
   */
  async assignPathToTrainee(pathId: string, traineeId: string): Promise<LearningPathEntity> {
    if (!pathId || !traineeId) {
      throw new BadRequestException('Path ID and Trainee ID are required.');
    }

    // Delegate directly to the entity service method
    return await this.learningPathEntityService.assignTraineeToPath(pathId, traineeId);
  }

  /**
   * 3. GET SINGLE PATH DETAILS
   */
  async getPathById(pathId: string): Promise<LearningPathEntity> {
    const path = await this.learningPathEntityService.findPathWithDetails(pathId);
    if (!path) {
      throw new NotFoundException(`Learning path with ID "${pathId}" not found.`);
    }
    return path;
  }

  /**
   * 4. CREATE PATH DELEGATE
   */
  async createPath(dto: any, creatorId: string): Promise<LearningPathEntity> {
    return await this.learningPathEntityService.createPath(dto, creatorId);
  }

  /**
   * 5. UPDATE PATH DELEGATE
   */
  async updatePath(pathId: string, dto: any): Promise<LearningPathEntity> {
    return await this.learningPathEntityService.updatePath(pathId, dto);
  }

  /**
   * 6. DELETE PATH DELEGATE
   */
  async deletePath(pathId: string): Promise<void> {
    return await this.learningPathEntityService.deletePath(pathId);
  }
}