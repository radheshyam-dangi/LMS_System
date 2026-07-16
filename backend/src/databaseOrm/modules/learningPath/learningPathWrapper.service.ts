import { Injectable } from '@nestjs/common';
import { LearningPathEntityService } from './learningPath.service';
import { LearningPathEntity } from '../../entities/learningPath.entity';

@Injectable()
export class LearningPathService {
  constructor(
    private readonly learningPathEntityService: LearningPathEntityService
  ) {}

  // High-level pipeline forwarding to fetch structured tracks based on active workspace sessions
  async getPathsForUserContext(role: string, userId: string): Promise<LearningPathEntity[]> {
    return this.learningPathEntityService.findAllPathsForUser(role, userId);
  }

  // Assign an existing database track to a designated Trainee student cohort profile pool
  async assignPathToTrainee(pathId: string, traineeId: string): Promise<LearningPathEntity> {
    const path = await this.learningPathEntityService.findOne(pathId);
    if (!path) {
      throw new Error('Target database entry reference row not found.');
    }

    if (!path.assignedToTraineeIds) {
      path.assignedToTraineeIds = [];
    }

    if (!path.assignedToTraineeIds.includes(traineeId)) {
      path.assignedToTraineeIds.push(traineeId);
    }

    return this.learningPathEntityService.update(pathId, {
      assignedToTraineeIds: path.assignedToTraineeIds
    } as any);
  }
}