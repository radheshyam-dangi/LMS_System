import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { UserLessonProgressEntity } from '../entities/userLessonProgress.entity';

@Injectable()
export class UserLessonProgressService extends BaseService<UserLessonProgressEntity> {
  protected repository: Repository<UserLessonProgressEntity>
  constructor(
    public datasource: DataSource,
  ) {
    super();
    this.repository= datasource.getRepository(UserLessonProgressEntity)
  }

  async findProgressByUser(userId: string): Promise<UserLessonProgressEntity[]> {
    return await this.repository.find({
      where: { user: { id: userId } } as any,
      relations: ['lesson'],
    });
  }
}