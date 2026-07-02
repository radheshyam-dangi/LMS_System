import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { LearningPathEntity } from '../entities/learningPath.entity';

@Injectable()
export class LearningPathEntityService extends BaseService<LearningPathEntity> {
  protected repository: Repository<LearningPathEntity>;
  constructor(
    datasource : DataSource
  ) {
    super();
    this.repository = datasource.getRepository<LearningPathEntity>(LearningPathEntity)
  }

  /**
   * Custom Query Example: Find all live learning paths with their assigned modules
   */
  async findActivePathsWithModules(): Promise<LearningPathEntity[]> {
    return await this.repository.find({
      where: { status: 'active' } as any,
      relations: ['modules'],
    });
  }
}