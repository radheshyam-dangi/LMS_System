import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { SubmissionEntity } from '../entities/submission.entity';

@Injectable()
export class SubmissionEntityService extends BaseService<SubmissionEntity> {
  protected repository: Repository<SubmissionEntity>;
  constructor(
    datasource : DataSource
  ) {
    super();
    this.repository = datasource.getRepository<SubmissionEntity>(SubmissionEntity)
  }

  async findSubmissionsByUser(userId: string): Promise<SubmissionEntity[]> {
    return await this.repository.find({
      where: { user: { id: userId } } as any,
    });
  }
}