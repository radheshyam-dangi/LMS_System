import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { UserLessonProgressEntity } from '../entities/userLessonProgress.entity';

@Injectable()
export class UserLessonProgressService extends BaseService<UserLessonProgressEntity> {
  constructor(
    @InjectRepository(UserLessonProgressEntity)
    private readonly progressRepository: Repository<UserLessonProgressEntity>,
  ) {
    super(progressRepository);
  }

  async findProgressByUser(userId: string): Promise<UserLessonProgressEntity[]> {
    return await this.progressRepository.find({
      where: { user: { id: userId } } as any,
      relations: ['lesson'],
    });
  }
}