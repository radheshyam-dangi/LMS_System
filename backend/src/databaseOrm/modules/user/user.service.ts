import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, Repository, ILike, In } from 'typeorm';
import { BaseService } from '../../../common/services/base.service';
import { UserEntity } from '../../entities/user.entity';
import { RoleEntity } from '../../entities/role.entity';
import { UserLessonProgressEntity } from '../../entities/userLessonProgress.entity';
import { AssignmentSubmissionEntity } from '../../entities/assignmentSubmission.entity';
import { UserResourceVisitEntity } from '../../entities/userResourceVisit.entity';
import { EvaluationEntity } from '../../entities/evaluation.entity';
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { EnrollmentEntity } from '../../entities/enrollment.entity';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { UserModel } from '../../../types/models/user.model';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { ProgressEntityService } from '../progress/progress.service';

const SYSTEM_ROLES = ['Admin', 'Trainee', 'Trainer'] as const;
type SystemRole = (typeof SYSTEM_ROLES)[number];

@Injectable()
export class UserEntityService extends BaseService<UserEntity> {
  protected repository: Repository<UserEntity>;
  protected roleRepository: Repository<RoleEntity>;

  constructor(
    datasource: DataSource,
    private readonly progressService: ProgressEntityService
  ) {
    super();
    this.repository = datasource.getRepository<UserEntity>(UserEntity);
    this.roleRepository = datasource.getRepository<RoleEntity>(RoleEntity);
  }

  async findAll(): Promise<UserEntity[]> {
    return await this.repository.find({ relations: ['roles', 'primaryRole'] });
  }

  async findOne(id: any): Promise<UserEntity | null> {
    return await this.repository.findOne({
      where: { id },
      relations: ['roles', 'primaryRole'],
    });
  }

  async create(
    data: UserModel & { roles?: string[]; primaryRole?: string },
  ): Promise<UserEntity> {
    if (!data.password) {
      throw new BadRequestException('Password is required');
    }

    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new BadRequestException('User already exists with this email');
    }

    await this.ensureSystemRoles();

    // 1. Resolve the array of roles sent in the payload body
    const assignedRoles: RoleEntity[] = [];
    if (data.roles && data.roles.length > 0) {
      for (const rName of data.roles) {
        const rEntity = await this.getRoleByName(rName as SystemRole);
        assignedRoles.push(rEntity);
      }
    } else {
      // Fallback if no roles are passed
      const userCount = await this.repository.count();
      const defaultRoleName: SystemRole = userCount === 0 ? 'Admin' : 'Trainee';
      const defaultRole = await this.getRoleByName(defaultRoleName);
      assignedRoles.push(defaultRole);
    }

    // 2. Resolve the targeted Primary Role relation
    let primaryRoleEntity: RoleEntity | undefined;
    if (data.primaryRole) {
      primaryRoleEntity = await this.getRoleByName(
        data.primaryRole as SystemRole,
      );
    } else {
      primaryRoleEntity = assignedRoles[0]; // Fallback to first role
    }

    // 3. Securely hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(data.password, saltRounds);

    // 4. Instantiate the record
    const user = this.repository.create({
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      roles: assignedRoles,
      primaryRole: primaryRoleEntity,
    });

    return await this.repository.save(user);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return await this.repository.findOne({
      where: { email },
      relations: ['roles', 'primaryRole'],
    });
  }

  async findRoleRequests(): Promise<UserEntity[]> {
    const users = await this.findAll();
    return users.filter((user) =>
      user.roles?.some((role) => role.name === 'Trainee'),
    );
  }

  async updateUserRole(userId: any, roleName: string): Promise<UserEntity> {
    if (!SYSTEM_ROLES.includes(roleName as SystemRole)) {
      throw new BadRequestException('Role must be Admin, Trainee, or Trainer');
    }

    const user = await this.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.getRoleByName(roleName as SystemRole);
    user.roles = [role];

    return await this.repository.save(user);
  }

  /**
   * 🌟 FETCH ALL USERS WHO POSSESS A SPECIFIC ROLE
   * Filters across multi-role setups (e.g. users having 'Trainee' role anywhere in their list)
   */
  async findUsersByRole(role: string): Promise<UserEntity[]> {
    return await this.repository.find({
      relations: ['roles', 'primaryRole'],
      where: [
        {
          roles: {
            name: ILike(role), // Matches role name regardless of casing in roles array
          },
        },
        {
          primaryRole: {
            name: ILike(role), // Fallback check against primaryRole relation
          },
        },
      ],
    });
  }

  private async ensureSystemRoles(): Promise<void> {
    for (const name of SYSTEM_ROLES) {
      const existingRole = await this.roleRepository.findOneBy({ name });
      if (!existingRole) {
        await this.roleRepository.save(this.roleRepository.create({ name }));
      }
    }
  }

  private async getRoleByName(name: SystemRole): Promise<RoleEntity> {
    const role = await this.roleRepository.findOneBy({ name });
    if (!role) {
      throw new NotFoundException(`${name} role not found`);
    }
    return role;
  }


  async updateUserStatus(id: string, isActive: boolean): Promise<UserEntity> {
    const user = await this.findOne(id);
    if (!user) throw new NotFoundException('User not found');
    user.isActive = isActive;
    return await this.repository.save(user);
  }

  async removeUser(id: string, requesterId: string): Promise<any> {
    if (id === requesterId) {
      throw new BadRequestException('You cannot delete yourself.');
    }
    const user = await this.findOne(id);
    if (!user) throw new NotFoundException('User not found');

    if (user.primaryRole?.name === 'Admin') {
      const adminCount = await this.repository.count({
        where: { primaryRole: { name: 'Admin' }, isActive: true, deletedAt: null } as any
      });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot delete the last admin.');
      }
    }

    if (user.primaryRole?.name === 'Trainer') {
      const em = this.repository.manager;
      const myAssignments = await em.find(AssignmentEntity, { where: { createdBy: { id } } as any });
      if (myAssignments.length > 0) {
        const assignmentIds = myAssignments.map(a => a.id);
        const pendingEvaluationsCount = await em.count(AssignmentSubmissionEntity, {
          where: { assignment: { id: In(assignmentIds) }, status: 'Submitted' } as any,
        });
        if (pendingEvaluationsCount > 0) {
          throw new BadRequestException(`Cannot delete Trainer: They have ${pendingEvaluationsCount} pending evaluations. Reassign them first.`);
        }
      }
    }
    return await this.repository.softRemove(user);
  }

  async getUserProfileStats(id: string): Promise<any> {
    const user = await this.findOne(id);
    if (!user) throw new NotFoundException('User not found');

    const primaryRole = user.primaryRole?.name || 'Trainee';
    const em = this.repository.manager;

    const stats: any = {};
    const activities: any[] = [];

    if (primaryRole === 'Trainee') {
      const enrollments = await em.find(EnrollmentEntity, {
        where: { user: { id } },
        relations: ['learningPath'],
      });

      const accurateStats = await this.progressService.statsForUser(id);

      stats.progress = accurateStats.lessonProgressPercent;

      let completedLPs = 0;
      for (const enrollment of enrollments) {
        if (enrollment.learningPath?.id) {
          const lpProg = await this.progressService.getLPProgress(id, enrollment.learningPath.id);
          if (lpProg >= 100) completedLPs++;
        }
      }
      stats.lpCompleted = completedLPs;

      stats.assignmentsCompleted = accurateStats.tasksSubmitted;
      stats.score = accurateStats.averageScore;

      const latestLesson = await em.findOne(UserLessonProgressEntity, {
        where: { user: { id } },
        order: { updatedAt: 'DESC' },
        relations: ['lesson', 'lesson.module'],
      });
      const latestResource = await em.findOne(UserResourceVisitEntity, {
        where: { user: { id } },
        order: { visitedAt: 'DESC' },
        relations: ['resource', 'resource.module', 'resource.lesson', 'resource.lesson.module'],
      });

      const candidates: { title: string, time: number }[] = [];
      if (latestLesson?.lesson?.module?.title) {
        candidates.push({ title: latestLesson.lesson.module.title, time: latestLesson.updatedAt?.getTime() || 0 });
      }
      if (latestResource) {
        const mod = latestResource.resource?.module || latestResource.resource?.lesson?.module;
        if (mod?.title) {
          candidates.push({ title: mod.title, time: latestResource.visitedAt?.getTime() || 0 });
        }
      }

      let maxTime = 0;
      let currentMod = 'None';

      for (const c of candidates) {
        if (c.time >= maxTime) {
          maxTime = c.time;
          currentMod = c.title;
        }
      }

      const actualSubmissions = await em.find(AssignmentSubmissionEntity, {
        where: { trainee: { id } } as any,
        relations: ['assignment', 'assignment.module', 'assignment.lesson', 'assignment.lesson.module'],
      });

      for (const sub of actualSubmissions) {
        const mod = sub.assignment?.module || sub.assignment?.lesson?.module;
        if (mod?.title) {
          const subTime = new Date(sub.submittedAt || 0).getTime();
          if (subTime >= maxTime) {
            maxTime = subTime;
            currentMod = mod.title;
          }
        }
      }

      stats.currentModule = currentMod;
      const daysSinceJoined = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 3600 * 24);
      if (daysSinceJoined > 7 && stats.progress < 10) {
        (user as any).status = 'At Risk';
      } else {
        (user as any).status = user.isActive ? 'Active' : 'Inactive';
      }


      const allProgress = await em.find(UserLessonProgressEntity, {
        where: { user: { id }, isCompleted: true },
        order: { completedAt: 'DESC' },
        take: 3,
        relations: ['lesson'],
      });
      allProgress.forEach((p) => {
        activities.push({
          type: 'complete',
          description: `Completed lesson ${p.lesson?.title || 'Unknown'}`,
          date: p.completedAt || p.updatedAt,
        });
      });

      // actualSubmissions already queried above

      actualSubmissions.sort(
        (a: any, b: any) =>
          new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime(),
      );
      actualSubmissions.filter((s: any) => s.status !== 'AVAILABLE' && s.status !== 'LOCKED').slice(0, 3).forEach((s: any) => {
        activities.push({
          type: 'submit',
          description: `Submitted assignment ${s.assignment?.title || 'Unknown'}`,
          date: s.submittedAt || new Date(),
        });
      });
    } else if (primaryRole === 'Trainer') {
      const paths = await em.find(LearningPathEntity, {
        where: { createdBy: { id } } as any,
      });
      stats.pathsCreated = paths.length;

      const myAssignments = await em.find(AssignmentEntity, {
        where: { createdBy: { id } } as any,
      });
      stats.assignmentsCreated = myAssignments.length;

      const activeTrainees = new Set<string>();
      paths.forEach((p) => {
        if (p.assignedToTraineeIds) {
          p.assignedToTraineeIds.forEach((tid: any) => activeTrainees.add(tid));
        }
      });
      stats.activeTrainees = activeTrainees.size;
      stats.pathsAssigned = activeTrainees.size; // Alias for UI clarity

      let sumOfTraineeScores = 0;
      let traineesWithScoresCount = 0;
      for (const tid of activeTrainees) {
        const traineeSubmissions = await em.find(AssignmentSubmissionEntity, {
          where: { trainee: { id: tid } } as any,
        });
        let tScore = 0;
        let eCount = 0;
        traineeSubmissions.forEach((s) => {
          if (typeof s.score === 'number') {
            tScore += s.score;
            eCount++;
          }
        });
        if (eCount > 0) {
          sumOfTraineeScores += Math.round(tScore / eCount);
          traineesWithScoresCount++;
        }
      }
      stats.avgTraineeScore = traineesWithScoresCount > 0 ? Math.round(sumOfTraineeScores / traineesWithScoresCount) : 0;

      paths.sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      paths.slice(0, 3).forEach((p) => {
        activities.push({
          type: 'create',
          description: `Created learning path ${p.title}`,
          date: (p as any).createdAt,
        });
      });

      const evaluations = await em.find(EvaluationEntity, {
        where: { evaluator: { id } } as any,
      });
      evaluations.sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      evaluations.slice(0, 3).forEach((e: any) => {
        activities.push({
          type: 'complete',
          description: `Graded an assignment`,
          date: e.createdAt,
        });
      });

      // Calculate Trainer At Risk
      const pendingEvals = await em.count(AssignmentSubmissionEntity, {
        where: { assignment: { createdBy: { id } }, status: 'Submitted' } as any
      });
      if (pendingEvals > 5) (user as any).status = 'At Risk';
      else (user as any).status = user.isActive ? 'Active' : 'Inactive';

    } else if (primaryRole === 'Admin') {
      stats.usersManaged = await em.count(UserEntity, { where: { isActive: true } });
      (user as any).status = user.isActive ? 'Active' : 'Inactive';
    }

    activities.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return {
      ...user,
      stats: {
        ...stats,
        joinedDate: user.createdAt,
      },
      activities: activities.slice(0, 6),
    };
  }
}
