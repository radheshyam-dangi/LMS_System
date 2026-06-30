import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { LearningPathEntity } from '../entities/learningPath.entity';

@Injectable()
export class LearningPathService extends BaseService<LearningPathEntity> {
  constructor(
    @InjectRepository(LearningPathEntity)
    private readonly learningPathRepository: Repository<LearningPathEntity>,
  ) {
    super(learningPathRepository);
  }

  /**
   * Custom Query Example: Find all live learning paths with their assigned modules
   */
  async findActivePathsWithModules(): Promise<LearningPathEntity[]> {
    return await this.learningPathRepository.find({
      where: { status: 'active' } as any,
      relations: ['modules'],
    });
  }
}