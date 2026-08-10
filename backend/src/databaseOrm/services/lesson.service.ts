import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { LessonEntity } from '../entities/lesson.entity';
import { ModuleEntity } from '../entities/module.entity';
import { LearningPathEntity } from '../entities/learningPath.entity';
import { AssignmentEntity } from '../entities/assignment.entity';
import { UserEntity } from '../entities/user.entity';

@Injectable()
export class LessonEntityService extends BaseService<LessonEntity> {
  protected repository: Repository<LessonEntity>;
  private moduleRepository: Repository<ModuleEntity>;
  private lpRepository: Repository<LearningPathEntity>;
  private assignmentRepository: Repository<AssignmentEntity>;
  private userRepository: Repository<UserEntity>;

  constructor(private readonly datasource: DataSource) {
    super();
    this.repository = this.datasource.getRepository<LessonEntity>(LessonEntity);
    this.moduleRepository = this.datasource.getRepository<ModuleEntity>(ModuleEntity);
    this.lpRepository = this.datasource.getRepository<LearningPathEntity>(LearningPathEntity);
    this.assignmentRepository = this.datasource.getRepository<AssignmentEntity>(AssignmentEntity);
    this.userRepository = this.datasource.getRepository<UserEntity>(UserEntity);
  }

  /**
   * 🌟 OWNERSHIP VERIFICATION HELPER
   * Verifies if userId matches the owner of the parent Learning Path
   */
  async checkIsModulePathOwner(moduleId: string, userId: string): Promise<boolean> {
    if (!moduleId || !userId) return false;

    const module = await this.moduleRepository.findOne({
      where: { id: moduleId },
      relations: ['learningPath', 'learningPath.createdBy'],
    });

    if (!module || !module.learningPath) return false;

    const ownerId = module.learningPath.createdBy?.id || (module.learningPath as any)?.createdById;
    if (!ownerId) return false;

    return String(ownerId).toLowerCase() === String(userId).toLowerCase();
  }

  /**
   * 1. CREATE LESSON
   */
  async createLesson(dto: any, creatorId: string): Promise<LessonEntity> {
    const { moduleId, title, description, videoUrl, articleUrl, durationMinutes } = dto;

    if (!moduleId) {
      throw new BadRequestException('moduleId is required to associate a lesson with a module.');
    }

    if (!title) {
      throw new BadRequestException('Lesson title is required.');
    }

    try {
      const module = await this.moduleRepository.findOne({
        where: { id: moduleId },
        relations: ['learningPath', 'learningPath.createdBy'],
      });

      if (!module) {
        throw new NotFoundException(`Module with ID "${moduleId}" not found.`);
      }

      const creator = await this.userRepository.findOne({ where: { id: creatorId } });

      const newLesson = this.repository.create({
        title,
        description: description ?? null,
        videoUrl: videoUrl ?? null,
        articleUrl: articleUrl ?? null,
        durationMinutes: durationMinutes ? Number(durationMinutes) : 15,
        module,
        learningPath: module.learningPath,
        createdBy: creator || undefined,
      });

      return await this.repository.save(newLesson);
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to create lesson: ${error.message}`);
    }
  }

  /**
   * 2. UPDATE LESSON
   */
  async updateLesson(id: string, dto: any): Promise<LessonEntity> {
    const lesson = await this.findLessonById(id);

    const updatedLesson = this.repository.merge(lesson, {
      title: dto.title ?? lesson.title,
      description: dto.description ?? lesson.description,
      videoUrl: dto.videoUrl ?? lesson.videoUrl,
      articleUrl: dto.articleUrl ?? lesson.articleUrl,
      durationMinutes: dto.durationMinutes ? Number(dto.durationMinutes) : lesson.durationMinutes,
    });

    return await this.repository.save(updatedLesson);
  }

  /**
   * 3. DELETE LESSON
   */
  async deleteLesson(id: string): Promise<void> {
    const lesson = await this.repository.findOne({
      where: { id },
      relations: ['assignments'],
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID "${id}" not found.`);
    }

    if (lesson.assignments && lesson.assignments.length > 0) {
      await this.assignmentRepository.remove(lesson.assignments);
    }

    await this.repository.remove(lesson);
  }

  /**
   * 4. FIND LESSON BY ID WITH DETAILS
   */
  async findLessonById(id: string): Promise<LessonEntity> {
    const lesson = await this.repository.findOne({
      where: { id },
      relations: ['module', 'module.learningPath', 'module.learningPath.createdBy', 'assignments', 'resources'],
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID "${id}" not found.`);
    }

    return lesson;
  }

  /**
   * 5. FETCH LESSONS BY MODULE ID
   */
  async findLessonsByModuleId(moduleId: string): Promise<LessonEntity[]> {
    return await this.repository.find({
      where: { module: { id: moduleId } },
      relations: ['assignments', 'resources', 'createdBy'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * 6. FETCH LESSONS BY LEARNING PATH ID
   */
  async findLessonsByPathId(learningPathId: string): Promise<LessonEntity[]> {
    return await this.repository.find({
      where: { module: { learningPath: { id: learningPathId } } },
      relations: ['assignments', 'resources', 'module', 'createdBy'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * 7. FETCH ALL LESSONS
   */
  async findAll(): Promise<LessonEntity[]> {
    return await this.repository.find({
      relations: ['assignments', 'module', 'module.learningPath'],
      order: { createdAt: 'ASC' },
    });
  }
}