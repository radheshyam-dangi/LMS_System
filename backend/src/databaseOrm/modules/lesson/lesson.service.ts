import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource, Repository, In } from 'typeorm';
import { BaseService } from '../../../common/services/base.service';
import { LessonEntity } from '../../entities/lesson.entity';
import { ModuleEntity } from '../../entities/module.entity';
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { UserEntity } from '../../entities/user.entity';

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
    this.moduleRepository =
      this.datasource.getRepository<ModuleEntity>(ModuleEntity);
    this.lpRepository =
      this.datasource.getRepository<LearningPathEntity>(LearningPathEntity);
    this.assignmentRepository =
      this.datasource.getRepository<AssignmentEntity>(AssignmentEntity);
    this.userRepository = this.datasource.getRepository<UserEntity>(UserEntity);
  }

  /**
   * 🌟 OWNERSHIP VERIFICATION HELPER
   * Verifies if userId matches the owner of the parent Learning Path
   */
  async checkIsModulePathOwner(
    moduleId: string,
    userId: string,
  ): Promise<boolean> {
    if (!moduleId || !userId) return false;

    const module = await this.moduleRepository.findOne({
      where: { id: moduleId },
      relations: ['learningPath', 'learningPath.createdBy'],
    });

    if (!module || !module.learningPath) return false;

    const ownerId =
      module.learningPath.createdBy?.id ||
      (module.learningPath as any)?.createdById;
    if (!ownerId) return false;

    return String(ownerId).toLowerCase() === String(userId).toLowerCase();
  }

  /**
   * 1. CREATE LESSON
   */
  async createLesson(dto: any, creatorId: string): Promise<LessonEntity> {
    const {
      moduleId,
      title,
      description,
      videoUrl,
      articleUrl,
      durationMinutes,
    } = dto;

    if (!moduleId) {
      throw new BadRequestException(
        'moduleId is required to associate a lesson with a module.',
      );
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

      const creator = await this.userRepository.findOne({
        where: { id: creatorId },
      });

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
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to create lesson: ${error.message}`,
      );
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
      durationMinutes: dto.durationMinutes
        ? Number(dto.durationMinutes)
        : lesson.durationMinutes,
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
   * 🌟 DYNAMIC LOCK STATE ATTACHMENT
   * Takes a list of lessons and a userId, calculates their lock state, and returns the modified objects.
   */
  async attachLockStateToLessons(lessons: LessonEntity[], userId?: string): Promise<any[]> {
    if (!userId || lessons.length === 0) {
      return lessons.map(l => ({ ...l, isLocked: false, lockReason: null }));
    }

    const lessonsByModuleId = new Map<string, LessonEntity[]>();
    for (const lesson of lessons) {
      const modId = lesson.module?.id;
      if (modId) {
        if (!lessonsByModuleId.has(modId)) lessonsByModuleId.set(modId, []);
        lessonsByModuleId.get(modId)!.push(lesson);
      }
    }

    const moduleIds = Array.from(lessonsByModuleId.keys());
    if (moduleIds.length === 0) {
      return lessons.map(l => ({ ...l, isLocked: false, lockReason: null }));
    }

    const modulesCorrect = await this.moduleRepository.find({
      where: { id: In(moduleIds) },
      relations: ['learningPath']
    });
    const moduleMap = new Map(modulesCorrect.map(m => [m.id, m]));

    // Fetch all lessons for these modules to determine the true sequence order
    const allModuleLessons = await this.repository.find({
      where: moduleIds.map(id => ({ module: { id } })),
      relations: ['module'],
      order: { displayOrder: 'ASC' }
    });

    // Fetch user progress for these modules
    const userProgress = await this.datasource.getRepository('UserLessonProgressEntity').find({
      where: moduleIds.map(id => ({
        user: { id: userId },
        lesson: { module: { id } },
        isCompleted: true
      })),
      relations: ['lesson']
    });
    
    const completedLessonIds = new Set(userProgress.map((p: any) => p.lesson?.id));

    const result = [];
    for (const lesson of lessons) {
      const modId = lesson.module?.id;
      const mod = modId ? moduleMap.get(modId) : null;
      const lp = mod?.learningPath;
      
      // 🌟 Check two-tier locking: LP level OR Module level
      const lpLockEnabled = lp ? (lp.lockLessons !== false) : true;
      const modLockEnabled = mod ? (mod.lessonLocking === true) : false;
      const isLockEnabled = lpLockEnabled || modLockEnabled;
      
      if (!mod || !isLockEnabled) {
        result.push({ ...lesson, isLocked: false, lockReason: null });
        continue;
      }

      const siblingLessons = allModuleLessons.filter(l => l.module?.id === mod.id);
      const priorLessons = siblingLessons.filter(l => l.displayOrder < lesson.displayOrder);
      
      const incompletePrior = priorLessons.find(l => !completedLessonIds.has(l.id));
      if (incompletePrior) {
        result.push({ 
          ...lesson, 
          isLocked: true, 
          lockReason: `Complete '${incompletePrior.title}' to unlock this lesson.` 
        });
      } else {
        result.push({ ...lesson, isLocked: false, lockReason: null });
      }
    }
    return result;
  }

  /**
   * 4. FIND LESSON BY ID WITH DETAILS
   */
  async findLessonById(id: string, userId?: string): Promise<any> {
    const lesson = await this.repository.findOne({
      where: { id },
      relations: [
        'module',
        'module.learningPath',
        'module.learningPath.createdBy',
        'assignments',
        'resources',
      ],
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID "${id}" not found.`);
    }

    const [lessonWithLockState] = await this.attachLockStateToLessons([lesson], userId);
    
    if (lessonWithLockState.isLocked) {
      // 🚨 Reject direct API access if locked
      const { ForbiddenException } = require('@nestjs/common');
      throw new ForbiddenException(JSON.stringify({ 
        code: 'LOCKED_PREREQUISITE_LESSON_INCOMPLETE', 
        message: lessonWithLockState.lockReason 
      }));
    }

    return lessonWithLockState;
  }

  /**
   * 5. FETCH LESSONS BY MODULE ID
   */
  async findLessonsByModuleId(moduleId: string, userId?: string): Promise<any[]> {
    const lessons = await this.repository.find({
      where: { module: { id: moduleId } },
      relations: ['assignments', 'resources', 'createdBy', 'module'],
      order: { displayOrder: 'ASC' },
    });
    return this.attachLockStateToLessons(lessons, userId);
  }

  /**
   * 6. FETCH LESSONS BY LEARNING PATH ID
   */
  async findLessonsByPathId(learningPathId: string, userId?: string): Promise<any[]> {
    const lessons = await this.repository.find({
      where: { module: { learningPath: { id: learningPathId } } },
      relations: ['assignments', 'resources', 'module', 'createdBy'],
      order: { displayOrder: 'ASC' },
    });
    return this.attachLockStateToLessons(lessons, userId);
  }

  /**
   * 7. FETCH ALL LESSONS
   */
  async findAll(userId?: string): Promise<any[]> {
    const lessons = await this.repository.find({
      relations: ['assignments', 'module', 'module.learningPath'],
      order: { displayOrder: 'ASC' },
    });
    return this.attachLockStateToLessons(lessons, userId);
  }
}
