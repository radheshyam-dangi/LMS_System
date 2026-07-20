import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { ModuleEntity } from '../entities/module.entity';
import { LearningPathModuleEntity } from '../entities/learningPathModule.entity';
import { LearningPathEntity } from '../entities/learningPath.entity';

@Injectable()
export class ModuleEntityService extends BaseService<ModuleEntity> {
  protected repository: Repository<ModuleEntity>;
  private lpmRepository: Repository<LearningPathModuleEntity>;
  private lpRepository: Repository<LearningPathEntity>;

  constructor(private readonly datasource: DataSource) {
    super();
    this.repository = this.datasource.getRepository<ModuleEntity>(ModuleEntity);
    this.lpmRepository = this.datasource.getRepository<LearningPathModuleEntity>(LearningPathModuleEntity);
    this.lpRepository = this.datasource.getRepository<LearningPathEntity>(LearningPathEntity);
  }

  /**
   * Creates a Module connected to a LearningPath & optionally a Parent Module
   */
  async createModuleForPath(dto: any, creatorId: string): Promise<ModuleEntity> {
    const { learningPathId, parentId, title, description, difficultyLevel, displayOrder } = dto;

    if (!learningPathId) {
      throw new BadRequestException('learningPathId is required to associate a module with a path.');
    }

    const queryRunner = this.datasource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Resolve Learning Path
      const learningPath = await queryRunner.manager.findOne(LearningPathEntity, { where: { id: learningPathId } });
      if (!learningPath) {
        throw new NotFoundException(`Learning Path with ID "${learningPathId}" does not exist.`);
      }

      // 2. Resolve Parent Module if provided
      let parentModule: ModuleEntity | undefined = undefined;
      if (parentId) {
        const foundParent = await queryRunner.manager.findOne(ModuleEntity, { where: { id: parentId } });
        if (!foundParent) {
          throw new NotFoundException(`Parent Module with ID "${parentId}" does not exist.`);
        }
        parentModule = foundParent;
      }

      // 3. Create & Save Module Record (Populating learningPath & parent)
      const newModule = queryRunner.manager.create(ModuleEntity, {
        title,
        description: description ?? undefined,
        difficultyLevel: difficultyLevel ?? 'Intermediate',
        status: 'Active',
        learningPath,
        ...(parentModule ? { parent: parentModule } : {}),
        createdBy: { id: creatorId } as any,
      });

      const savedModule = await queryRunner.manager.save(newModule);

      // 4. Calculate displayOrder for Junction Table
      let order = displayOrder;
      if (order === undefined || order === null) {
        const existingCount = await queryRunner.manager.count(LearningPathModuleEntity, {
          where: { learningPath: { id: learningPathId } },
        });
        order = existingCount + 1;
      }

      // 5. Save Junction Record in LearningPathModule
      const lpm = queryRunner.manager.create(LearningPathModuleEntity, {
        learningPath,
        module: savedModule,
        displayOrder: order,
      });

      await queryRunner.manager.save(lpm);

      await queryRunner.commitTransaction();

      return await this.findModuleWithDetails(savedModule.id);
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(`Failed to create module: ${errorMessage}`);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Fetches modules specifically attached to a LearningPath ID
   */
  async findModulesByPathId(learningPathId: string): Promise<ModuleEntity[]> {
    return await this.repository.find({
      where: { learningPath: { id: learningPathId } },
      relations: ['subModules', 'lessons', 'parent', 'createdBy'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Fetches single module with submodules, lessons, and parent details
   */
  async findModuleWithDetails(id: string): Promise<ModuleEntity> {
    const result = await this.repository.findOne({
      where: { id },
      relations: ['subModules', 'lessons', 'parent', 'createdBy', 'learningPath'],
    });
    if (!result) throw new NotFoundException(`Module with ID "${id}" not found.`);
    return result;
  }
}