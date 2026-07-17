import { Injectable, NotFoundException } from '@nestjs/common';
import { LearningPathEntityService } from './learningPath.service';
import { LearningPathEntity } from '../../entities/learningPath.entity';

@Injectable()
export class LearningPathService {
  constructor(
    private readonly learningPathEntityService: LearningPathEntityService
  ) {}

  async getPathsForUserContext(role: string, userId: string): Promise<LearningPathEntity[]> {
    return this.learningPathEntityService.findAllPathsForUser(role, userId) as Promise<LearningPathEntity[]>;
  }

  async assignPathToTrainee(pathId: string, traineeId: string): Promise<LearningPathEntity> {
    const path = await this.learningPathEntityService.findOne(pathId) as LearningPathEntity | null;
    
    if (!path) {
      throw new NotFoundException('Target database entry reference row not found.');
    }

    if (!path.assignedToTraineeIds) {
      path.assignedToTraineeIds = [];
    }

    if (!path.assignedToTraineeIds.includes(traineeId)) {
      path.assignedToTraineeIds.push(traineeId);
    }

    const updatedPath = await this.learningPathEntityService.update(pathId, {
      assignedToTraineeIds: path.assignedToTraineeIds
    } as any) as LearningPathEntity | null;

    if (!updatedPath) {
      throw new NotFoundException('Failed to update the learning path.');
    }

    return updatedPath;
  }
}