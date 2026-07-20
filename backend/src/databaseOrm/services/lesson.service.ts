import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { LessonEntity } from '../entities/lesson.entity';
import { ModuleEntity } from '../entities/module.entity';

@Injectable()
export class LessonEntityService extends BaseService<LessonEntity> {
  toggleLessonProgress(userId: any, lessonId: string, isCompleted: boolean) {
    throw new Error('Method not implemented.');
  }
  protected repository: Repository<LessonEntity>;
  private moduleRepository: Repository<ModuleEntity>;

  constructor(private readonly datasource: DataSource) {
    super();
    this.repository = this.datasource.getRepository<LessonEntity>(LessonEntity);
    this.moduleRepository = this.datasource.getRepository<ModuleEntity>(ModuleEntity);
  }

  async createLessonWithModule(dto: any, creatorId: string): Promise<LessonEntity> {
    const module = await this.moduleRepository.findOne({ where: { id: dto.moduleId } });
    if (!module) {
      throw new NotFoundException(`Module with ID "${dto.moduleId}" not found.`);
    }

    const newLesson = this.repository.create({
      title: dto.title,
      description: dto.description ?? undefined,
      videoUrl: dto.videoUrl ?? undefined,
      articleUrl: dto.articleUrl ?? undefined,
      durationMinutes: dto.durationMinutes ?? 15,
      module,
    });

    return await this.repository.save(newLesson);
  }

  async findLessonsByModuleId(moduleId: string): Promise<LessonEntity[]> {
    return await this.repository.find({
      where: { module: { id: moduleId } },
      relations: ['assignments'],
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });
  }
}