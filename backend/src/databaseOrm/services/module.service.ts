import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { ModuleEntity } from '../entities/module.entity';
import { LearningPathEntity } from '../entities/learningPath.entity';
import { UserEntity } from '../entities/user.entity';
import { LessonEntity } from '../entities/lesson.entity';
import { ModuleKeyPointEntity } from '../entities/moduleKeyPoint.entity';

@Injectable()
export class ModuleEntityService extends BaseService<ModuleEntity> {
  protected repository: Repository<ModuleEntity>;
  private lpRepository: Repository<LearningPathEntity>;
  private userRepository: Repository<UserEntity>;
  private lessonRepository: Repository<LessonEntity>;
  private keyPointRepository: Repository<ModuleKeyPointEntity>;

  constructor(private readonly datasource: DataSource) {
    super();
    this.repository = this.datasource.getRepository<ModuleEntity>(ModuleEntity);
    this.lpRepository = this.datasource.getRepository<LearningPathEntity>(LearningPathEntity);
    this.userRepository = this.datasource.getRepository<UserEntity>(UserEntity);
    this.lessonRepository = this.datasource.getRepository<LessonEntity>(LessonEntity);
    this.keyPointRepository = this.datasource.getRepository<ModuleKeyPointEntity>(ModuleKeyPointEntity);
  }

  /**
   * 🌟 OWNERSHIP VERIFICATION HELPER
   * Verifies if userId matches the owner of the Learning Path
   */
  async checkIsPathOwner(learningPathId: string, userId: string): Promise<boolean> {
    if (!learningPathId || !userId) return false;

    const learningPath = await this.lpRepository.findOne({
      where: { id: learningPathId },
      relations: ['createdBy'],
    });

    if (!learningPath) return false;

    const ownerId = learningPath.createdBy?.id || (learningPath as any)?.createdById;
    if (!ownerId) return false;

    return String(ownerId).toLowerCase() === String(userId).toLowerCase();
  }

  /**
   * 1. CREATE MODULE
   */
  async createModuleForPath(dto: any, creatorId: string): Promise<ModuleEntity> {
    const {
      learningPathId,
      title,
      description,
      imageUrl,
      status,
      level,
      resources,
      objectives,
      outcomes,
      keyPoints,
      durationLabel,
      durationWeeks,
      difficultyLevel,
    } = dto;

    if (!learningPathId) {
      throw new BadRequestException('learningPathId is required to associate a module with a path.');
    }

    if (!title) {
      throw new BadRequestException('Module title is required.');
    }

    try {
      const learningPath = await this.lpRepository.findOne({ 
        where: { id: learningPathId },
        relations: ['createdBy'],
      });
      if (!learningPath) {
        throw new NotFoundException(`Learning Path with ID "${learningPathId}" does not exist.`);
      }

      const creator = await this.userRepository.findOne({ where: { id: creatorId } });
      if (!creator) {
        throw new BadRequestException(`User session invalid. User ID "${creatorId}" not found.`);
      }

      const parseList = (v: any): string[] => {
        if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
        if (typeof v === 'string') return v.split('\n').map((s) => s.trim()).filter(Boolean);
        return [];
      };

      const newModule = this.repository.create({
        title,
        description: description ?? null,
        imageUrl: imageUrl ?? null,
        status: status ?? 'Active',
        level: level ?? difficultyLevel ?? 'Beginner',
        difficultyLevel: difficultyLevel ?? level ?? 'Beginner',
        durationLabel: durationLabel ?? (durationWeeks ? `${durationWeeks} weeks` : '2 weeks'),
        durationWeeks: Number(durationWeeks) || 2,
        objectives: parseList(objectives),
        outcomes: parseList(outcomes),
        resources: resources ?? null,
        learningPath,
        createdBy: creator,
      });

      const savedModule = await this.repository.save(newModule);

      const parsedKeyPoints = parseList(keyPoints);
      if (parsedKeyPoints.length > 0) {
        for (const kp of parsedKeyPoints) {
          await this.keyPointRepository.save(
            this.keyPointRepository.create({
              title: kp,
              description: kp,
              module: savedModule,
            })
          );
        }
      }

      return await this.findModuleWithDetails(savedModule.id);
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to create module: ${error.message}`);
    }
  }

  /**
   * 2. UPDATE MODULE
   */
  async updateModule(id: string, dto: any): Promise<ModuleEntity> {
    const module = await this.findModuleWithDetails(id);
    const patch = { ...dto };
    if (dto.objectives !== undefined) {
      patch.objectives = Array.isArray(dto.objectives)
        ? dto.objectives
        : String(dto.objectives || '')
            .split('\n')
            .map((s: string) => s.trim())
            .filter(Boolean);
    }
    if (dto.outcomes !== undefined) {
      patch.outcomes = Array.isArray(dto.outcomes)
        ? dto.outcomes
        : String(dto.outcomes || '')
            .split('\n')
            .map((s: string) => s.trim())
            .filter(Boolean);
    }
    if (dto.durationWeeks !== undefined) {
      patch.durationWeeks = Number(dto.durationWeeks) || module.durationWeeks;
      if (!dto.durationLabel) patch.durationLabel = `${patch.durationWeeks} weeks`;
    }
    if (dto.keyPoints !== undefined) {
      const parseList = (v: any): string[] => {
        if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
        if (typeof v === 'string') return v.split('\n').map((s) => s.trim()).filter(Boolean);
        return [];
      };
      const parsed = parseList(dto.keyPoints);
      await this.keyPointRepository.delete({ module: { id } } as any);
      for (const kp of parsed) {
        await this.keyPointRepository.save(
          this.keyPointRepository.create({
            title: kp,
            description: kp,
            module: { id } as any,
          })
        );
      }
    }
    const updatedModule = this.repository.merge(module, patch);
    await this.repository.save(updatedModule);
    return await this.findModuleWithDetails(id);
  }

  /**
   * 3. DELETE MODULE
   */
  async deleteModule(id: string): Promise<void> {
    const module = await this.repository.findOne({
      where: { id },
      relations: ['lessons'],
    });

    if (!module) {
      throw new NotFoundException(`Module with ID "${id}" not found.`);
    }

    if (module.lessons && module.lessons.length > 0) {
      await this.lessonRepository.remove(module.lessons);
    }

    await this.repository.remove(module);
  }

  /**
   * 4. FETCH MODULES BY LEARNING PATH
   */
  async findModulesByPathId(learningPathId: string): Promise<ModuleEntity[]> {
    try {
      return await this.repository.find({
        where: {
          learningPath: { id: learningPathId },
        },
        relations: [
          'resources',
          'lessons',
          'lessons.assignments',
          'lessons.resources',
          'createdBy',
          'learningPath',
          'learningPath.createdBy',
        ],
        order: { createdAt: 'ASC' },
      });
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to fetch modules: ${error.message}`);
    }
  }

  /**
   * 5. FETCH ALL MODULES
   */
  async findAll(): Promise<ModuleEntity[]> {
    return await this.repository.find({
      relations: ['lessons', 'learningPath', 'learningPath.createdBy', 'createdBy'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * 6. FETCH MODULE WITH FULL DETAILS
   */
  async findModuleWithDetails(id: string): Promise<ModuleEntity> {
    const result = await this.repository.findOne({
      where: { id },
      relations: [
        'lessons',
        'lessons.assignments',
        'lessons.resources',
        'resources',
        'createdBy',
        'learningPath',
        'learningPath.createdBy',
      ],
    });
    if (!result) throw new NotFoundException(`Module with ID "${id}" not found.`);

    try {
      const keyPoints = await this.keyPointRepository.find({
        where: { module: { id } } as any,
      });
      (result as any).keyPoints = keyPoints;
    } catch {}

    return result;
  }
}