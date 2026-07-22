import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ResourceEntity } from '../entities/resource.entity';
import { ModuleEntity } from '../entities/module.entity';
import { LessonEntity } from '../entities/lesson.entity';

@Injectable()
export class ResourceEntityService {
  private repository: Repository<ResourceEntity>;
  private moduleRepo: Repository<ModuleEntity>;
  private lessonRepo: Repository<LessonEntity>;

  constructor(private readonly datasource: DataSource) {
    this.repository = this.datasource.getRepository(ResourceEntity);
    this.moduleRepo = this.datasource.getRepository(ModuleEntity);
    this.lessonRepo = this.datasource.getRepository(LessonEntity);
  }

  async createResource(dto: { title: string; url: string; moduleId?: string; lessonId?: string }) {
    const { title, url, moduleId, lessonId } = dto;

    if (!title || !url) {
      throw new BadRequestException('Title and URL are required.');
    }

    if (!moduleId && !lessonId) {
      throw new BadRequestException('Resource must be attached to either a Module or a Lesson.');
    }

    let moduleEntity: ModuleEntity | undefined;
    let lessonEntity: LessonEntity | undefined;

    if (moduleId) {
      moduleEntity = (await this.moduleRepo.findOne({ where: { id: moduleId } })) ?? undefined;
    }

    if (lessonId) {
      lessonEntity = (await this.lessonRepo.findOne({ where: { id: lessonId } })) ?? undefined;
    }

    const newResource = this.repository.create({
      title,
      url,
      module: moduleEntity,
      lesson: lessonEntity,
    });

    return await this.repository.save(newResource);
  }
}