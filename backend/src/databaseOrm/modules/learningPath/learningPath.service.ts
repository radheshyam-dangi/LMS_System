import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BaseService } from '../../../common/services/base.service';
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { UserEntity } from '../../entities/user.entity';
import { ModuleEntity } from '../../entities/module.entity';
import { EnrollmentEntity } from '../../entities/enrollment.entity';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class LearningPathEntityService extends BaseService<LearningPathEntity> {
  protected repository: Repository<LearningPathEntity>;
  private userRepository: Repository<UserEntity>;
  private moduleRepository: Repository<ModuleEntity>;
  private enrollmentRepository: Repository<EnrollmentEntity>;

  constructor(
    private readonly datasource: DataSource,
    @Optional()
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService?: NotificationService,
  ) {
    super();
    this.repository =
      this.datasource.getRepository<LearningPathEntity>(LearningPathEntity);
    this.userRepository = this.datasource.getRepository<UserEntity>(UserEntity);
    this.moduleRepository =
      this.datasource.getRepository<ModuleEntity>(ModuleEntity);
    this.enrollmentRepository =
      this.datasource.getRepository<EnrollmentEntity>(EnrollmentEntity);
  }

  /**
   * 1. READ ALL PATHS
   */
  async findAll(): Promise<LearningPathEntity[]> {
    const paths = await this.repository.find({
      relations: ['createdBy', 'modules', 'modules.lessons'],
      order: { createdAt: 'DESC' },
    });

    const enrollments = await this.enrollmentRepository.find({
      relations: ['learningPath', 'user', 'assignedBy'],
    });

    const enrollMap = new Map();
    for (const e of enrollments) {
      if (!e.learningPath || !e.user || !e.assignedBy) continue;
      const key = `${e.learningPath.id}_${e.user.id}`;
      enrollMap.set(key, e.assignedBy);
    }

    for (const p of paths) {
      (p as any).traineeAssigners = {};
      for (const tId of (p.assignedToTraineeIds || [])) {
         const assigner = enrollMap.get(`${p.id}_${tId}`);
         if (assigner) {
           (p as any).traineeAssigners[tId] = assigner;
         }
      }
    }

    return paths;
  }

  /**
   * 2. FIND SINGLE PATH BY ID (Used for owner verification)
   */
  async findOne(id: string): Promise<LearningPathEntity> {
    const path = await this.repository.findOne({
      where: { id },
      relations: ['createdBy'],
    });

    if (!path) {
      throw new NotFoundException(`Learning Path with ID "${id}" not found.`);
    }

    return path;
  }

  /**
   * 3. FIND PATH WITH FULL HIERARCHY DETAILS
   */
  async findPathWithDetails(id: string): Promise<LearningPathEntity> {
    const path = await this.repository.findOne({
      where: { id },
      relations: [
        'createdBy',
        'modules',
        'modules.resources',
        'modules.lessons',
        'modules.lessons.assignments',
        'modules.lessons.resources',
      ],
      order: {
        createdAt: 'DESC',
      },
    });

    if (!path) {
      throw new NotFoundException(`Learning Path with ID "${id}" not found.`);
    }

    return path;
  }

  /**
   * 4. CREATE LEARNING PATH
   */
  async createPath(dto: any, creatorId: string): Promise<LearningPathEntity> {
    const {
      name,
      title,
      description,
      difficulty,
      duration,
      skillsTags,
      imageUrl,
      status,
    } = dto;

    const pathTitle = name || title;
    if (!pathTitle || !pathTitle.trim()) {
      throw new BadRequestException('Learning Path title / name is required.');
    }

    try {
      const creator = await this.userRepository.findOne({
        where: { id: creatorId },
      });
      if (!creator) {
        throw new BadRequestException(
          `Creator user with ID "${creatorId}" not found.`,
        );
      }

      const newPath = this.repository.create({
        title: pathTitle,
        description: description ?? null,
        difficulty: difficulty ?? 'Intermediate',
        duration: duration ?? '12 weeks',
        skillsTags: Array.isArray(skillsTags)
          ? skillsTags
          : skillsTags
            ? skillsTags.split(',')
            : ['General'],
        imageUrl: imageUrl ?? null,
        status: status ?? 'Active',
        createdBy: creator,
        assignedToTraineeIds: [],
        overallProgress: 0,
      });

      return await this.repository.save(newPath);
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        `Failed to create learning path: ${error.message}`,
      );
    }
  }

  /**
   * 5. UPDATE LEARNING PATH
   */
  async updatePath(id: string, dto: any): Promise<LearningPathEntity> {
    const path = await this.findOne(id);

    if (dto.skillsTags && typeof dto.skillsTags === 'string') {
      dto.skillsTags = dto.skillsTags.split(',').map((t: string) => t.trim());
    }

    if (dto.name && !dto.title) {
      dto.title = dto.name;
    }

    const updatedPath = this.repository.merge(path, dto);
    return await this.repository.save(updatedPath);
  }

  /**
   * 6. DELETE LEARNING PATH (Cascade cleanup)
   */
  async deletePath(id: string): Promise<void> {
    const path = await this.repository.findOne({
      where: { id },
      relations: ['modules'],
    });

    if (!path) {
      throw new NotFoundException(`Learning Path with ID "${id}" not found.`);
    }

    // Safely delete nested modules if database cascade isn't active
    if (path.modules && path.modules.length > 0) {
      await this.moduleRepository.remove(path.modules);
    }

    await this.repository.remove(path);
  }

  /**
   * 7. ASSIGN TRAINEE TO LEARNING PATH
   */
  async assignTraineeToPath(
    pathId: string,
    traineeId: string,
    assignerId?: string,
  ): Promise<LearningPathEntity> {
    const path = await this.findOne(pathId);

    // Verify Trainee User Exists
    const trainee = await this.userRepository.findOne({
      where: { id: traineeId },
    });
    if (!trainee) {
      throw new NotFoundException(`Trainee with ID "${traineeId}" not found.`);
    }

    const currentAssignments = path.assignedToTraineeIds || [];
    const isNew = !currentAssignments.includes(traineeId);

    // Prevent duplicate assignment entries
    if (isNew) {
      path.assignedToTraineeIds = [...currentAssignments, traineeId];
      await this.repository.save(path);
    }

    // Upsert enrollment row (DBML enrollments table)
    const existingEnrollment = await this.enrollmentRepository.findOne({
      where: {
        user: { id: traineeId },
        learningPath: { id: pathId },
      },
    });

    if (!existingEnrollment) {
      await this.enrollmentRepository.save(
        this.enrollmentRepository.create({
          user: { id: traineeId } as any,
          learningPath: { id: pathId } as any,
          status: 'active',
          enrolledAt: new Date(),
          assignedBy: assignerId ? { id: assignerId } as any : undefined,
        }),
      );
    } else if (existingEnrollment.status !== 'active') {
      existingEnrollment.status = 'active';
      await this.enrollmentRepository.save(existingEnrollment);
    }

    // Notify trainee (bell counter +1) only on first assignment
    if (isNew && this.notificationService) {
      await this.notificationService.create({
        userId: traineeId,
        type: 'learning_path_assigned',
        title: 'New learning path assigned',
        message: `"${path.title}" has been assigned to you.`,
        link: '/learning-paths',
        relatedEntityType: 'learning_path',
        relatedEntityId: pathId,
      });
    }

    return await this.findOne(pathId);
  }
}
