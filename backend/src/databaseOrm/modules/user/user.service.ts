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
import { SubmissionEntity } from '../../entities/submission.entity';
import { EvaluationEntity } from '../../entities/evaluation.entity';
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { EnrollmentEntity } from '../../entities/enrollment.entity';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { UserModel } from '../../../types/models/user.model';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

const SYSTEM_ROLES = ['Admin', 'Trainee', 'Trainer'] as const;
type SystemRole = (typeof SYSTEM_ROLES)[number];

@Injectable()
export class UserEntityService extends BaseService<UserEntity> {
  protected repository: Repository<UserEntity>;
  protected roleRepository: Repository<RoleEntity>;

  constructor(datasource: DataSource) {
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

      const submissions = await em.find(SubmissionEntity, {
        where: { user: { id } },
        relations: ['assignment', 'evaluations'],
      });

      const allProgressCount = await em.count(UserLessonProgressEntity, {
        where: { user: { id }, isCompleted: true },
      });
      // Calculate a rough progress percentage based on completions
      const totalActivities = allProgressCount + submissions.length;
      stats.progress =
        enrollments.length > 0
          ? Math.min(
              100,
              Math.round((totalActivities / (enrollments.length * 10)) * 100),
            )
          : 0;
      stats.lpCompleted = enrollments.filter(
        (e) => e.status === 'completed',
      ).length;
      stats.assignmentsCompleted = submissions.length;
      let totalScore = 0;
      let evaluatedCount = 0;
      submissions.forEach((s) => {
        if (
          s.evaluations &&
          s.evaluations.length > 0 &&
          s.evaluations[0].overallScore
        ) {
          totalScore += s.evaluations[0].overallScore;
          evaluatedCount++;
        }
      });
      stats.score = evaluatedCount
        ? Math.round(totalScore / evaluatedCount)
        : 0;

      const latestProgress = await em.findOne(UserLessonProgressEntity, {
        where: { user: { id } },
        order: { updatedAt: 'DESC' },
        relations: ['lesson', 'lesson.module'],
      });
      stats.currentModule = latestProgress?.lesson?.module?.title || 'None';

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

      submissions.sort(
        (a: any, b: any) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
      );
      submissions.slice(0, 3).forEach((s) => {
        activities.push({
          type: 'submit',
          description: `Submitted assignment ${s.assignment?.title || 'Unknown'}`,
          date: s.submittedAt,
        });
      });
    } else if (primaryRole === 'Trainer' || primaryRole === 'Admin') {
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

      let totalCompletedTasks = 0;
      if (myAssignments.length > 0 && activeTrainees.size > 0) {
        const assignmentIds = myAssignments.map((a) => a.id);
        const submissions = await em.find(SubmissionEntity, {
          where: {
            assignment: { id: In(assignmentIds) },
            status: In(['Accepted', 'Evaluated']),
          } as any,
        });
        totalCompletedTasks = submissions.length;
      }

      const totalExpectedTasks = myAssignments.length * activeTrainees.size;
      stats.avgTraineeScore =
        totalExpectedTasks > 0
          ? Math.round((totalCompletedTasks / totalExpectedTasks) * 100)
          : 0;

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
