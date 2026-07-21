import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { LessonEntity } from '../entities/lesson.entity';
import { ModuleEntity } from '../entities/module.entity';
import { LearningPathEntity } from '../entities/learningPath.entity';
import { UserLessonProgressEntity } from '../entities/userLessonProgress.entity';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class LessonEntityService extends BaseService<LessonEntity> {
  protected repository: Repository<LessonEntity>;
  private moduleRepository: Repository<ModuleEntity>;
  private learningPathRepository: Repository<LearningPathEntity>;
  private progressRepository: Repository<UserLessonProgressEntity>;

  constructor(private readonly datasource: DataSource) {
    super();
    this.repository = this.datasource.getRepository<LessonEntity>(LessonEntity);
    this.moduleRepository = this.datasource.getRepository<ModuleEntity>(ModuleEntity);
    this.learningPathRepository = this.datasource.getRepository<LearningPathEntity>(LearningPathEntity);
    this.progressRepository = this.datasource.getRepository<UserLessonProgressEntity>(UserLessonProgressEntity);
  }

  /**
   * Toggle Lesson Progress (For Trainees)
   */
  async toggleLessonProgress(userId: string, lessonId: string, isCompleted: boolean) {
    if (!UUID_REGEX.test(lessonId)) {
      throw new BadRequestException(`"${lessonId}" is not a valid UUID format.`);
    }

    const lesson = await this.repository.findOne({ where: { id: lessonId } });
    if (!lesson) {
      throw new NotFoundException(`Lesson with ID "${lessonId}" non-existent.`);
    }

    let progress = await this.progressRepository.findOne({
      where: {
        user: { id: userId },
        lesson: { id: lessonId },
      } as any,
    });

    if (progress) {
      progress.isCompleted = isCompleted;
      progress.completedAt = new Date();
    } else {
      progress = this.progressRepository.create({
        user: { id: userId } as any,
        lesson,
        isCompleted,
        completedAt: new Date(),
      });
    }

    return await this.progressRepository.save(progress);
  }

  /**
   * CREATE LESSON (Supports both Module and LearningPath)
   */
  async createLesson(dto: any, creatorId: string): Promise<LessonEntity> {
    const { moduleId, learningPathId, title, description, videoUrl, articleUrl, durationMinutes } = dto;

    if (!moduleId && !learningPathId) {
      throw new BadRequestException('Either moduleId or learningPathId must be provided.');
    }

    let targetModule: ModuleEntity | undefined;
    let targetLearningPath: LearningPathEntity | undefined;
    let ownerId: string | undefined;

    // 1. Resolve Module parent
    if (moduleId) {
      if (!UUID_REGEX.test(moduleId)) {
        throw new BadRequestException(`"${moduleId}" is not a valid UUID format for moduleId.`);
      }

      targetModule = (await this.moduleRepository.findOne({
        where: { id: moduleId },
        relations: ['learningPath', 'learningPath.createdBy', 'createdBy'],
      })) ?? undefined;

      if (!targetModule) {
        throw new NotFoundException(`Module with ID "${moduleId}" not found.`);
      }

      ownerId = targetModule.learningPath?.createdBy?.id || targetModule.createdBy?.id;
    } 
    // 2. Resolve LearningPath parent
    else if (learningPathId) {
      if (!UUID_REGEX.test(learningPathId)) {
        throw new BadRequestException(`"${learningPathId}" is not a valid UUID format for learningPathId.`);
      }

      targetLearningPath = (await this.learningPathRepository.findOne({
        where: { id: learningPathId },
        relations: ['createdBy'],
      })) ?? undefined;

      if (!targetLearningPath) {
        throw new NotFoundException(`Learning Path with ID "${learningPathId}" not found.`);
      }

      ownerId = targetLearningPath.createdBy?.id;
    }

    // 🔒 Ownership Check
    if (ownerId && ownerId !== creatorId) {
      throw new ForbiddenException('Only the owner of this Learning Path can create lessons.');
    }

    // 3. Create and Save Lesson
    const newLesson = this.repository.create({
      title,
      description: description ?? undefined,
      videoUrl: videoUrl ?? undefined,
      articleUrl: articleUrl ?? dto.articleContent ?? undefined,
      durationMinutes: durationMinutes ?? 15,
      ...(targetModule ? { module: targetModule } : {}),
      ...(targetLearningPath ? { learningPath: targetLearningPath } : {}),
    });

    return await this.repository.save(newLesson);
  }

  /**
   * ✅ ADDED: Backward-compatible alias for controllers calling createLessonWithModule
   */
  async createLessonWithModule(dto: any, creatorId: string): Promise<LessonEntity> {
    return await this.createLesson(dto, creatorId);
  }

  async findLessonsByModuleId(moduleId: string): Promise<LessonEntity[]> {
    if (!UUID_REGEX.test(moduleId)) {
      throw new BadRequestException(`"${moduleId}" is not a valid UUID format.`);
    }
    return await this.repository.find({
      where: { module: { id: moduleId } },
      relations: ['assignments'],
      order: { createdAt: 'ASC' } as any,
    });
  }

  async findLessonsByLearningPathId(learningPathId: string): Promise<LessonEntity[]> {
    if (!UUID_REGEX.test(learningPathId)) {
      throw new BadRequestException(`"${learningPathId}" is not a valid UUID format.`);
    }
    return await this.repository.find({
      where: { learningPath: { id: learningPathId } },
      relations: ['assignments'],
      order: { createdAt: 'ASC' } as any,
    });
  }
}