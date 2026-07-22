import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { ModuleEntity } from '../entities/module.entity';
import { LearningPathEntity } from '../entities/learningPath.entity';
import { UserEntity } from '../entities/user.entity';

@Injectable()
export class ModuleEntityService extends BaseService<ModuleEntity> {
  protected repository: Repository<ModuleEntity>;
  private lpRepository: Repository<LearningPathEntity>;
  private userRepository: Repository<UserEntity>;

  constructor(private readonly datasource: DataSource) {
    super();
    this.repository = this.datasource.getRepository<ModuleEntity>(ModuleEntity);
    this.lpRepository = this.datasource.getRepository<LearningPathEntity>(LearningPathEntity);
    this.userRepository = this.datasource.getRepository<UserEntity>(UserEntity);
  }

  /**
   * Creates a Module connected directly to a LearningPath
   */
  async createModuleForPath(dto: any, creatorId: string): Promise<ModuleEntity> {
    const { learningPathId, title, description } = dto;

    if (!learningPathId) {
      throw new BadRequestException('learningPathId is required to associate a module with a path.');
    }

    if (!title) {
      throw new BadRequestException('Module title is required.');
    }

    try {
      // 1. Verify Learning Path
      const learningPath = await this.lpRepository.findOne({ where: { id: learningPathId } });
      if (!learningPath) {
        throw new NotFoundException(`Learning Path with ID "${learningPathId}" does not exist.`);
      }

      // 2. Verify User
      const creator = await this.userRepository.findOne({ where: { id: creatorId } });
      if (!creator) {
        throw new BadRequestException(`User session invalid. User ID "${creatorId}" not found.`);
      }

      // 3. Create Module Record
      const newModule = this.repository.create({
        title,
        description: description ?? null,
        learningPath,
        createdBy: creator,
      });

      const savedModule = await this.repository.save(newModule);
      return await this.findModuleWithDetails(savedModule.id);
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to create module: ${error.message}`);
    }
  }

  /**
   * Fetches modules specifically attached to a LearningPath ID with full hierarchy
   */
async findModulesByPathId(learningPathId: string): Promise<ModuleEntity[]> {
  try {
    return await this.repository.find({
      where: {
        learningPath: { id: learningPathId }
      },
      relations: [
        'resources',           // Module-level resources
        'lessons',             // Lessons in module
        'lessons.assignments', // Tasks in lesson
        'lessons.resources',   // 👈 🌟 ADD THIS: Loads resources attached to each lesson!
        'createdBy'
      ],
      order: { createdAt: 'ASC' },
    });
  } catch (error: any) {
    throw new InternalServerErrorException(`Failed to fetch modules: ${error.message}`);
  }
}

  /**
   * Fetches single module with lessons and details
   */
  async findModuleWithDetails(id: string): Promise<ModuleEntity> {
    const result = await this.repository.findOne({
      where: { id },
      relations: [
        'lessons',
        'lessons.assignments', // 👈 FIXED: Changed 'lessons.tasks' -> 'lessons.assignments'
        'createdBy',
        'learningPath'
      ],
    });
    if (!result) throw new NotFoundException(`Module with ID "${id}" not found.`);
    return result;
  }
}