import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { SubmissionEntity } from '../entities/submission.entity';

@Injectable()
export class SubmissionService extends BaseService<SubmissionEntity> {
  constructor(
    @InjectRepository(SubmissionEntity)
    private readonly submissionRepository: Repository<SubmissionEntity>,
  ) {
    super(submissionRepository);
  }

  async findSubmissionsByUser(userId: string): Promise<SubmissionEntity[]> {
    return await this.submissionRepository.find({
      where: { user: { id: userId } } as any,
    });
  }
}