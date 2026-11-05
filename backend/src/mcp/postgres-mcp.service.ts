import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource, ILike, In, Not, Repository } from 'typeorm';
import { FastMCP } from '@prefecthq/fastmcp-ts/server';
import { UserEntity } from '../databaseOrm/entities/user.entity';
import { EnrollmentEntity } from '../databaseOrm/entities/enrollment.entity';
import { LearningPathEntity } from '../databaseOrm/entities/learningPath.entity';
import { ModuleEntity } from '../databaseOrm/entities/module.entity';
import { UserLessonProgressEntity } from '../databaseOrm/entities/userLessonProgress.entity';
import { AssignmentSubmissionEntity } from '../databaseOrm/entities/assignmentSubmission.entity';

export interface EnrolledCourseSummary {
  id: string;
  title: string;
  status: string;
  assignedBy?: string;
  enrolledAt?: string;
}

export interface TraineeRecord {
  fullName: string;
  email: string;
  status: 'Active' | 'Inactive';
  isActive: boolean;
  joinedDate: string;
  enrolledPathsCount: number;
  enrolledCourses: EnrolledCourseSummary[];
  streak: number;
}

export interface GetTraineesArgs {
  status?: 'all' | 'active' | 'inactive';
  search?: string;
  course_name_or_id?: string;
  has_assigned_paths?: boolean;
  assigned_by_trainer?: string;
  limit?: number;
}

export interface TraineesQueryResult {
  success: boolean;
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  targetCourseTitle?: string;
  filterApplied: {
    status: string;
    search?: string;
    courseFilter?: string;
    hasAssignedPaths?: boolean;
    assignedByTrainer?: string;
  };
  summary: string;
  trainees: TraineeRecord[];
}

export interface LearningPathSummaryRecord {
  id: string;
  title: string;
  description?: string;
  difficulty: string;
  status: string;
  moduleCount: number;
  lessonCount: number;
  assignmentCount: number;
  creatorName: string;
  createdAt: string;
  enrolledTraineesCount: number;
  enrolledTraineeNames?: string[];
}

export interface GetLearningPathsArgs {
  status?: 'all' | 'active' | 'draft';
  search?: string;
  difficulty?: 'all' | 'Beginner' | 'Intermediate' | 'Advanced';
  trainer?: string;
  limit?: number;
  count_only?: boolean;
}

export interface LearningPathsQueryResult {
  success: boolean;
  totalCount: number;
  activeCount: number;
  draftCount: number;
  difficultyBreakdown: {
    beginner: number;
    intermediate: number;
    advanced: number;
  };
  filterApplied: {
    status?: string;
    search?: string;
    difficulty?: string;
    trainer?: string;
  };
  summary: string;
  learningPaths: LearningPathSummaryRecord[];
}

export interface AuthoredCourseSummary {
  id: string;
  title: string;
  status: string;
  difficulty: string;
  enrolledTraineesCount: number;
}

export interface TrainerRecord {
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  joinedDate: string;
  authoredCoursesCount: number;
  authoredCourses: AuthoredCourseSummary[];
  assignedTraineesCount: number;
}

export interface GetTrainersArgs {
  search?: string;
  limit?: number;
}

export interface TrainersQueryResult {
  success: boolean;
  totalTrainers: number;
  activeTrainers: number;
  summary: string;
  filterApplied: {
    search?: string;
  };
  trainers: TrainerRecord[];
}

export interface EnrollmentDetailRecord {
  traineeName: string;
  traineeEmail: string;
  courseTitle: string;
  courseStatus: string;
  progressPercent: number;
  progressStatus: 'Completed' | 'In Progress' | 'Not Started';
  completedLessons: number;
  totalLessons: number;
  completedTasks: number;
  totalTasks: number;
  assignedByName?: string;
  assignedByEmail?: string;
  status: string;
  enrolledAt: string;
}

export interface GetTraineeProgressArgs {
  trainee_name_or_email?: string;
  course_name_or_id?: string;
}

export interface ModuleProgressDetail {
  moduleTitle: string;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
  completedTasks: number;
  totalTasks: number;
}

export interface TraineeCourseProgress {
  courseTitle: string;
  courseStatus: string;
  overallProgressPercent: number;
  status: 'Completed' | 'In Progress' | 'Not Started';
  completedLessons: number;
  totalLessons: number;
  completedTasks: number;
  totalTasks: number;
  enrolledAt: string;
  modules: ModuleProgressDetail[];
}

export interface TraineeProgressResult {
  success: boolean;
  traineeName: string;
  traineeEmail: string;
  totalCoursesEnrolled: number;
  courses: TraineeCourseProgress[];
  summary: string;
}

export interface GetEnrollmentsArgs {
  course_title?: string;
  trainee_search?: string;
  trainer_search?: string;
  status?: 'all' | 'active' | 'completed';
  limit?: number;
}

export interface EnrollmentsQueryResult {
  success: boolean;
  totalEnrollments: number;
  uniqueTraineesCount: number;
  uniqueCoursesCount: number;
  summary: string;
  filterApplied: {
    course?: string;
    trainee?: string;
    trainer?: string;
    status?: string;
  };
  enrollments: EnrollmentDetailRecord[];
}

@Injectable()
export class PostgresMcpService implements OnModuleInit {
  private readonly logger = new Logger(PostgresMcpService.name);
  private fastMcpServer!: FastMCP;
  private userRepo!: Repository<UserEntity>;
  private enrollmentRepo!: Repository<EnrollmentEntity>;
  private lpRepo!: Repository<LearningPathEntity>;
  private lessonProgRepo!: Repository<UserLessonProgressEntity>;
  private submissionRepo!: Repository<AssignmentSubmissionEntity>;
  private moduleRepo!: Repository<ModuleEntity>;

  constructor(private readonly dataSource: DataSource) {
    this.userRepo = this.dataSource.getRepository(UserEntity);
    this.enrollmentRepo = this.dataSource.getRepository(EnrollmentEntity);
    this.lpRepo = this.dataSource.getRepository(LearningPathEntity);
    this.lessonProgRepo = this.dataSource.getRepository(UserLessonProgressEntity);
    this.submissionRepo = this.dataSource.getRepository(AssignmentSubmissionEntity);
    this.moduleRepo = this.dataSource.getRepository(ModuleEntity);
  }

  onModuleInit() {
    this.initializeMcpServer();
  }

  /**
   * Initializes FastMCP server and registers MCP tools
   */
  private initializeMcpServer() {
    this.fastMcpServer = new FastMCP({
      name: 'lms-postgres-mcp',
      version: '1.0.0',
    });

    // 1. Tool: get_trainee_users
    this.fastMcpServer.tool(
      {
        name: 'get_trainee_users',
        description:
          'Fetches registered users with Trainee role from PostgreSQL in JSON. Provides name, email, active status, join date, streak, enrolled courses, and filters by specific course or assignment status.',
      },
      async (args: GetTraineesArgs = {}) => {
        return await this.getTraineeUsers(args);
      },
    );

    // 2. Tool: get_learning_paths
    this.fastMcpServer.tool(
      {
        name: 'get_learning_paths',
        description:
          'Fetches Learning Paths (courses/curriculum) from PostgreSQL in JSON format. Provides total count, status breakdown (Active, Draft), difficulty levels, module/lesson counts, creator, and enrolled trainee counts.',
      },
      async (args: GetLearningPathsArgs = {}) => {
        return await this.getLearningPaths(args);
      },
    );

    // 3. Tool: get_trainer_users
    this.fastMcpServer.tool(
      {
        name: 'get_trainer_users',
        description:
          'Fetches Instructors/Trainers and Administrators from PostgreSQL in JSON format. Provides name, email, role, authored courses count, and assigned trainee count.',
      },
      async (args: GetTrainersArgs = {}) => {
        return await this.getTrainerUsers(args);
      },
    );

    // 4. Tool: get_enrollment_records
    this.fastMcpServer.tool(
      {
        name: 'get_enrollment_records',
        description:
          'Queries enrollment relationships between trainees, trainers, and courses from PostgreSQL. Shows who is enrolled in what course and which trainer assigned it.',
      },
      async (args: GetEnrollmentsArgs = {}) => {
        return await this.getEnrollmentRecords(args);
      },
    );

    // 5. Tool: get_trainee_progress
    this.fastMcpServer.tool(
      {
        name: 'get_trainee_progress',
        description:
          'Queries real-time progress percentage, completed lessons count, submitted assessments count, and module-by-module breakdown for a trainee in a specific Learning Path or across all their courses.',
      },
      async (args: any = {}) => {
        return await this.getTraineeProgress(args);
      },
    );

    this.logger.log('FastMCP PostgreSQL server initialized with 5 enterprise LMS tools.');
  }

  /**
   * Core tool execution logic: queries PostgreSQL and returns sanitized Trainee records in JSON
   */
  async getTraineeUsers(args: GetTraineesArgs = {}): Promise<TraineesQueryResult> {
    const status = args.status || 'all';
    const search = args.search?.trim().toLowerCase();
    const courseFilterRaw = args.course_name_or_id?.trim();
    const hasAssignedPaths = Boolean(args.has_assigned_paths);
    const assignedByTrainer = args.assigned_by_trainer?.trim().toLowerCase();
    const limit = Math.min(Math.max(args.limit || 50, 1), 100);

    try {
      // 1. Fetch users with Trainee or Learner role (checking both primaryRole and roles list)
      const users = await this.userRepo.find({
        relations: ['roles', 'primaryRole'],
        where: [
          { roles: { name: ILike('Trainee') } },
          { primaryRole: { name: ILike('Trainee') } },
          { roles: { name: ILike('learner') } },
          { primaryRole: { name: ILike('learner') } },
        ],
        order: { createdAt: 'DESC' },
        take: 500,
      });

      // De-duplicate users (in case both relations match)
      const userMap = new Map<string, UserEntity>();
      for (const u of users) {
        userMap.set(u.id, u);
      }
      let uniqueUsers = Array.from(userMap.values());

      // 2. Fetch all enrollments with learningPath, user, assignedBy
      const allEnrollments = await this.enrollmentRepo.find({
        relations: ['learningPath', 'user', 'assignedBy'],
      });

      // Fetch all learning paths with assignedToTraineeIds
      const allPaths = await this.lpRepo.find({
        select: ['id', 'title', 'status', 'assignedToTraineeIds'],
      });

      // 3. Build a map of Trainee ID -> EnrolledCourseSummary[]
      const traineeCoursesMap = new Map<string, Map<string, EnrolledCourseSummary>>();

      for (const enr of allEnrollments) {
        if (!enr.user?.id || !enr.learningPath) continue;
        const uId = enr.user.id;
        if (!traineeCoursesMap.has(uId)) {
          traineeCoursesMap.set(uId, new Map());
        }
        const courseMap = traineeCoursesMap.get(uId)!;
        const assignedBy = enr.assignedBy
          ? `${enr.assignedBy.firstName || ''} ${enr.assignedBy.lastName || ''}`.trim() || enr.assignedBy.email
          : undefined;

        courseMap.set(enr.learningPath.id, {
          id: enr.learningPath.id,
          title: enr.learningPath.title,
          status: enr.status || 'active',
          assignedBy,
          enrolledAt: enr.enrolledAt ? new Date(enr.enrolledAt).toISOString().split('T')[0] : undefined,
        });
      }

      // Also check lp.assignedToTraineeIds for courses assigned directly
      for (const lp of allPaths) {
        if (Array.isArray(lp.assignedToTraineeIds)) {
          for (const tId of lp.assignedToTraineeIds) {
            if (!traineeCoursesMap.has(tId)) {
              traineeCoursesMap.set(tId, new Map());
            }
            const courseMap = traineeCoursesMap.get(tId)!;
            if (!courseMap.has(lp.id)) {
              courseMap.set(lp.id, {
                id: lp.id,
                title: lp.title,
                status: 'assigned',
              });
            }
          }
        }
      }

      // 4. Course Enrollment Filter (e.g. "enrolled in Machine Learning path")
      let matchedTargetCourseTitle: string | undefined = undefined;
      if (courseFilterRaw) {
        const cLower = courseFilterRaw.toLowerCase();
        const matchedLp = allPaths.find(
          (p) =>
            p.id.toLowerCase() === cLower ||
            p.title.toLowerCase() === cLower ||
            p.title.toLowerCase().includes(cLower) ||
            cLower.includes(p.title.toLowerCase()),
        );

        if (matchedLp) {
          matchedTargetCourseTitle = matchedLp.title;
          uniqueUsers = uniqueUsers.filter((u) => traineeCoursesMap.get(u.id)?.has(matchedLp.id));
        } else {
          // If course didn't match any LP, return 0
          matchedTargetCourseTitle = courseFilterRaw;
          uniqueUsers = [];
        }
      }

      // 5. Assigned Paths Filter (e.g. "how many trainee have Learning Path Assigned by trainer")
      if (hasAssignedPaths) {
        uniqueUsers = uniqueUsers.filter((u) => (traineeCoursesMap.get(u.id)?.size || 0) > 0);
      }

      // 6. Assigned By Trainer Filter
      if (assignedByTrainer) {
        uniqueUsers = uniqueUsers.filter((u) => {
          const courses = Array.from(traineeCoursesMap.get(u.id)?.values() || []);
          return courses.some((c) => (c.assignedBy || '').toLowerCase().includes(assignedByTrainer));
        });
      }

      // 7. Status Filter (active / inactive / all)
      if (status === 'active') {
        uniqueUsers = uniqueUsers.filter((u) => u.isActive === true);
      } else if (status === 'inactive') {
        uniqueUsers = uniqueUsers.filter((u) => u.isActive === false);
      }

      // 8. Search filter by name or email
      if (search) {
        uniqueUsers = uniqueUsers.filter((u) => {
          const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
          const email = (u.email || '').toLowerCase();
          return fullName.includes(search) || email.includes(search);
        });
      }

      // Accurate Total Aggregates before pagination
      const totalCount = uniqueUsers.length;
      const activeCount = uniqueUsers.filter((u) => u.isActive === true).length;
      const inactiveCount = uniqueUsers.filter((u) => u.isActive === false).length;

      const finalUsers = uniqueUsers.slice(0, limit);

      const trainees: TraineeRecord[] = finalUsers.map((u) => {
        const first = u.firstName?.trim() || '';
        const last = u.lastName?.trim() || '';
        const fullName = `${first} ${last}`.trim() || 'Anonymous Trainee';
        const courses = Array.from(traineeCoursesMap.get(u.id)?.values() || []);
        return {
          fullName,
          email: u.email,
          status: u.isActive ? 'Active' : 'Inactive',
          isActive: Boolean(u.isActive),
          joinedDate: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : 'N/A',
          enrolledPathsCount: courses.length,
          enrolledCourses: courses,
          streak: u.lastCelebratedStreak || 0,
        };
      });

      let summary = '';
      if (matchedTargetCourseTitle) {
        summary = `There are currently ${totalCount} trainees enrolled in "${matchedTargetCourseTitle}" (${activeCount} Active, ${inactiveCount} Inactive).`;
      } else if (hasAssignedPaths) {
        summary = `There are currently ${totalCount} trainees with at least one Learning Path assigned (${activeCount} Active, ${inactiveCount} Inactive).`;
      } else if (search) {
        summary = `Found ${totalCount} trainees matching "${search}" (${activeCount} Active, ${inactiveCount} Inactive).`;
      } else {
        summary = `There are currently ${totalCount} total registered trainees in the LMS (${activeCount} Active, ${inactiveCount} Inactive).`;
      }

      return {
        success: true,
        totalCount,
        activeCount,
        inactiveCount,
        targetCourseTitle: matchedTargetCourseTitle,
        filterApplied: {
          status,
          search: search || undefined,
          courseFilter: matchedTargetCourseTitle || undefined,
          hasAssignedPaths: hasAssignedPaths ? true : undefined,
          assignedByTrainer: assignedByTrainer || undefined,
        },
        summary,
        trainees,
      };
    } catch (err) {
      this.logger.error(`Error querying PostgreSQL trainees via FastMCP: ${(err as Error).message}`, (err as Error).stack);
      return {
        success: false,
        totalCount: 0,
        activeCount: 0,
        inactiveCount: 0,
        filterApplied: { status, search },
        summary: 'Failed to retrieve trainees from database.',
        trainees: [],
      };
    }
  }

  /**
   * Queries PostgreSQL Learning Paths (courses/curriculum) and returns sanitized metrics, counts, and summaries in JSON
   */
  async getLearningPaths(args: GetLearningPathsArgs = {}): Promise<LearningPathsQueryResult> {
    const statusFilter = (args.status || 'all').toLowerCase();
    const search = args.search?.trim().toLowerCase();
    const difficultyFilter = args.difficulty && args.difficulty !== 'all' ? args.difficulty.toLowerCase() : null;
    const trainerFilter = args.trainer?.trim().toLowerCase();
    const limit = Math.min(Math.max(args.limit || 50, 1), 100);

    try {
      const allPaths = await this.lpRepo.find({
        relations: ['createdBy', 'modules', 'modules.lessons', 'modules.assignments'],
        order: { createdAt: 'DESC' },
        take: 500,
      });

      // Filter out deleted or archived paths if any
      let filtered = allPaths.filter((p) => p.status !== 'deleted' && p.status !== 'archived');

      // Global status breakdown before filters
      const totalCount = filtered.length;
      const activeCount = filtered.filter((p) => (p.status || '').toLowerCase() === 'active').length;
      const draftCount = filtered.filter((p) => (p.status || '').toLowerCase().includes('draft')).length;
      const beginnerCount = filtered.filter((p) => (p.difficulty || '').toLowerCase() === 'beginner' || (p.difficulty || '').toLowerCase() === 'basic').length;
      const intermediateCount = filtered.filter((p) => (p.difficulty || '').toLowerCase() === 'intermediate').length;
      const advancedCount = filtered.filter((p) => (p.difficulty || '').toLowerCase() === 'advanced' || (p.difficulty || '').toLowerCase() === 'hard').length;

      // Apply status filter if specific
      if (statusFilter === 'active') {
        filtered = filtered.filter((p) => (p.status || '').toLowerCase() === 'active');
      } else if (statusFilter === 'draft' || statusFilter === 'ai_draft') {
        filtered = filtered.filter((p) => (p.status || '').toLowerCase().includes('draft'));
      }

      // Apply difficulty filter
      if (difficultyFilter) {
        filtered = filtered.filter((p) => (p.difficulty || '').toLowerCase().includes(difficultyFilter));
      }

      // Apply trainer/creator filter
      if (trainerFilter) {
        filtered = filtered.filter((p) => {
          const ownerFirst = (p.createdBy?.firstName || '').toLowerCase();
          const ownerLast = (p.createdBy?.lastName || '').toLowerCase();
          const ownerEmail = (p.createdBy?.email || '').toLowerCase();
          return ownerFirst.includes(trainerFilter) || ownerLast.includes(trainerFilter) || ownerEmail.includes(trainerFilter);
        });
      }

      // Apply search filter
      if (search) {
        filtered = filtered.filter((p) =>
          (p.title || '').toLowerCase().includes(search) ||
          (p.description || '').toLowerCase().includes(search),
        );
      }

      // Fetch all enrollments to populate enrolled count per course
      const allEnrollments = await this.enrollmentRepo.find({
        relations: ['learningPath', 'user'],
      });

      const displayList = filtered.slice(0, limit);

      const learningPaths: LearningPathSummaryRecord[] = displayList.map((p) => {
        const creatorFirst = p.createdBy?.firstName || '';
        const creatorLast = p.createdBy?.lastName || '';
        const creatorName = `${creatorFirst} ${creatorLast}`.trim() || p.createdBy?.email || 'System / AI';

        const modules = p.modules || [];
        const moduleCount = modules.length;
        const lessonCount = modules.reduce((sum, m) => sum + (m.lessons?.length || 0), 0);
        const assignmentCount = modules.reduce((sum, m) => sum + (m.assignments?.length || 0), 0);

        // Calculate enrolled trainees
        const enrolledTraineesMap = new Map<string, string>();
        for (const enr of allEnrollments) {
          if (enr.learningPath?.id === p.id && enr.user) {
            const name = `${enr.user.firstName || ''} ${enr.user.lastName || ''}`.trim() || enr.user.email;
            enrolledTraineesMap.set(enr.user.id, name);
          }
        }
        if (Array.isArray(p.assignedToTraineeIds)) {
          for (const tId of p.assignedToTraineeIds) {
            if (!enrolledTraineesMap.has(tId)) {
              enrolledTraineesMap.set(tId, `Trainee (${tId.slice(0, 8)})`);
            }
          }
        }

        return {
          id: p.id,
          title: p.title,
          description: p.description ? (p.description.length > 120 ? p.description.slice(0, 117) + '...' : p.description) : undefined,
          difficulty: p.difficulty || 'Intermediate',
          status: p.status || 'Active',
          moduleCount,
          lessonCount,
          assignmentCount,
          creatorName,
          createdAt: p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : 'N/A',
          enrolledTraineesCount: enrolledTraineesMap.size,
          enrolledTraineeNames: Array.from(enrolledTraineesMap.values()).slice(0, 10),
        };
      });

      const summary = `There are currently ${totalCount} total Learning Paths in the database (${activeCount} Active, ${draftCount} AI Drafts). Difficulty distribution: ${beginnerCount} Beginner, ${intermediateCount} Intermediate, ${advancedCount} Advanced.`;

      return {
        success: true,
        totalCount,
        activeCount,
        draftCount,
        difficultyBreakdown: {
          beginner: beginnerCount,
          intermediate: intermediateCount,
          advanced: advancedCount,
        },
        filterApplied: {
          status: statusFilter,
          search: search || undefined,
          difficulty: difficultyFilter || undefined,
          trainer: trainerFilter || undefined,
        },
        summary,
        learningPaths,
      };
    } catch (err) {
      this.logger.error(`Error querying PostgreSQL learning paths via FastMCP: ${(err as Error).message}`, (err as Error).stack);
      return {
        success: false,
        totalCount: 0,
        activeCount: 0,
        draftCount: 0,
        difficultyBreakdown: { beginner: 0, intermediate: 0, advanced: 0 },
        filterApplied: { status: statusFilter, search },
        summary: 'Failed to retrieve Learning Paths from database.',
        learningPaths: [],
      };
    }
  }

  /**
   * Queries PostgreSQL Instructors / Trainers and Administrators and their authored courses
   */
  async getTrainerUsers(args: GetTrainersArgs = {}): Promise<TrainersQueryResult> {
    const search = args.search?.trim().toLowerCase();
    const limit = Math.min(Math.max(args.limit || 50, 1), 100);

    try {
      const trainers = await this.userRepo.find({
        relations: ['roles', 'primaryRole'],
        where: [
          { roles: { name: ILike('Trainer') } },
          { primaryRole: { name: ILike('Trainer') } },
          { roles: { name: ILike('Admin') } },
          { primaryRole: { name: ILike('Admin') } },
        ],
        order: { createdAt: 'DESC' },
      });

      const trainerMap = new Map<string, UserEntity>();
      for (const t of trainers) {
        trainerMap.set(t.id, t);
      }
      let uniqueTrainers = Array.from(trainerMap.values());

      if (search) {
        uniqueTrainers = uniqueTrainers.filter((t) => {
          const name = `${t.firstName || ''} ${t.lastName || ''}`.toLowerCase();
          const email = (t.email || '').toLowerCase();
          return name.includes(search) || email.includes(search);
        });
      }

      const allPaths = await this.lpRepo.find({
        relations: ['createdBy'],
        select: ['id', 'title', 'status', 'difficulty'],
      });

      const allEnrollments = await this.enrollmentRepo.find({
        relations: ['assignedBy', 'user'],
      });

      const totalTrainers = uniqueTrainers.length;
      const activeTrainers = uniqueTrainers.filter((t) => t.isActive).length;

      const displayTrainers = uniqueTrainers.slice(0, limit);

      const records: TrainerRecord[] = displayTrainers.map((t) => {
        const authored = allPaths.filter((p) => {
          const ownerId = (p as any)?.createdById || (p as any)?.createdBy?.id;
          return ownerId && String(ownerId).toLowerCase() === String(t.id).toLowerCase();
        });

        const assignedTraineeIds = new Set<string>();
        for (const enr of allEnrollments) {
          if (
            enr.assignedBy?.id &&
            String(enr.assignedBy.id).toLowerCase() === String(t.id).toLowerCase() &&
            enr.user?.id
          ) {
            assignedTraineeIds.add(enr.user.id);
          }
        }

        const roleName = t.primaryRole?.name || (t.roles && t.roles[0]?.name) || 'Trainer';

        return {
          fullName: `${t.firstName || ''} ${t.lastName || ''}`.trim() || t.email,
          email: t.email,
          role: roleName,
          isActive: Boolean(t.isActive),
          joinedDate: t.createdAt ? new Date(t.createdAt).toISOString().split('T')[0] : 'N/A',
          authoredCoursesCount: authored.length,
          authoredCourses: authored.map((p) => ({
            id: p.id,
            title: p.title,
            status: p.status,
            difficulty: p.difficulty,
            enrolledTraineesCount: 0,
          })),
          assignedTraineesCount: assignedTraineeIds.size,
        };
      });

      const summary = `There are currently ${totalTrainers} total Instructors/Trainers and Administrators in the LMS (${activeTrainers} Active).`;

      return {
        success: true,
        totalTrainers,
        activeTrainers,
        summary,
        filterApplied: { search: search || undefined },
        trainers: records,
      };
    } catch (err) {
      this.logger.error(`Error querying PostgreSQL trainers via FastMCP: ${(err as Error).message}`, (err as Error).stack);
      return {
        success: false,
        totalTrainers: 0,
        activeTrainers: 0,
        summary: 'Failed to retrieve trainers from database.',
        filterApplied: {},
        trainers: [],
      };
    }
  }

  /**
   * Queries PostgreSQL Enrollments (course assignments and student participations)
   */
  async getEnrollmentRecords(args: GetEnrollmentsArgs = {}): Promise<EnrollmentsQueryResult> {
    const courseTitle = args.course_title?.trim().toLowerCase();
    const traineeSearch = args.trainee_search?.trim().toLowerCase();
    const trainerSearch = args.trainer_search?.trim().toLowerCase();
    const statusFilter = (args.status || 'all').toLowerCase();
    const limit = Math.min(Math.max(args.limit || 50, 1), 100);

    try {
      const allEnrollments = await this.enrollmentRepo.find({
        relations: ['learningPath', 'user', 'assignedBy'],
        order: { enrolledAt: 'DESC' },
        take: 500,
      });

      let filtered = allEnrollments.filter((e) => Boolean(e.user && e.learningPath));

      if (courseTitle) {
        filtered = filtered.filter((e) =>
          (e.learningPath?.title || '').toLowerCase().includes(courseTitle),
        );
      }

      if (traineeSearch) {
        filtered = filtered.filter((e) => {
          const name = `${e.user?.firstName || ''} ${e.user?.lastName || ''}`.toLowerCase();
          const email = (e.user?.email || '').toLowerCase();
          return name.includes(traineeSearch) || email.includes(traineeSearch);
        });
      }

      if (trainerSearch) {
        filtered = filtered.filter((e) => {
          if (!e.assignedBy) return false;
          const name = `${e.assignedBy.firstName || ''} ${e.assignedBy.lastName || ''}`.toLowerCase();
          const email = (e.assignedBy.email || '').toLowerCase();
          return name.includes(trainerSearch) || email.includes(trainerSearch);
        });
      }

      if (statusFilter !== 'all') {
        filtered = filtered.filter((e) => (e.status || '').toLowerCase() === statusFilter);
      }

      const totalEnrollments = filtered.length;
      const uniqueTrainees = new Set(filtered.map((e) => e.user.id)).size;
      const uniqueCourses = new Set(filtered.map((e) => e.learningPath.id)).size;

      const displayEnrollments = filtered.slice(0, limit);

      const records: EnrollmentDetailRecord[] = await Promise.all(
        displayEnrollments.map(async (e) => {
          let progressPercent = 0;
          let progressStatus: 'Completed' | 'In Progress' | 'Not Started' = 'Not Started';
          let completedLessons = 0;
          let totalLessons = 0;
          let completedTasks = 0;
          let totalTasks = 0;

          if (e.user?.id && e.learningPath?.id) {
            try {
              const p = await this.calcLpProgress(e.user.id, e.learningPath.id);
              progressPercent = p.overallProgressPercent;
              progressStatus = p.status;
              completedLessons = p.completedLessons;
              totalLessons = p.totalLessons;
              completedTasks = p.completedTasks;
              totalTasks = p.totalTasks;
            } catch {}
          }

          return {
            traineeName: `${e.user?.firstName || ''} ${e.user?.lastName || ''}`.trim() || e.user?.email,
            traineeEmail: e.user?.email,
            courseTitle: e.learningPath?.title,
            courseStatus: e.learningPath?.status,
            progressPercent,
            progressStatus,
            completedLessons,
            totalLessons,
            completedTasks,
            totalTasks,
            assignedByName: e.assignedBy
              ? `${e.assignedBy.firstName || ''} ${e.assignedBy.lastName || ''}`.trim()
              : 'Self-enrolled / System',
            assignedByEmail: e.assignedBy?.email,
            status: e.status || 'active',
            enrolledAt: e.enrolledAt ? new Date(e.enrolledAt).toISOString().split('T')[0] : 'N/A',
          };
        }),
      );

      const summary = `Found ${totalEnrollments} enrollment records covering ${uniqueTrainees} unique trainees across ${uniqueCourses} courses.`;

      return {
        success: true,
        totalEnrollments,
        uniqueTraineesCount: uniqueTrainees,
        uniqueCoursesCount: uniqueCourses,
        summary,
        filterApplied: {
          course: courseTitle || undefined,
          trainee: traineeSearch || undefined,
          trainer: trainerSearch || undefined,
          status: statusFilter,
        },
        enrollments: records,
      };
    } catch (err) {
      this.logger.error(`Error querying PostgreSQL enrollments via FastMCP: ${(err as Error).message}`, (err as Error).stack);
      return {
        success: false,
        totalEnrollments: 0,
        uniqueTraineesCount: 0,
        uniqueCoursesCount: 0,
        summary: 'Failed to retrieve enrollments from database.',
        filterApplied: {},
        enrollments: [],
      };
    }
  }

  /**
   * Helper to compute real-time trainee progress for a specific learning path.
   */
  async calcLpProgress(userId: string, lpId: string): Promise<{
    overallProgressPercent: number;
    status: 'Completed' | 'In Progress' | 'Not Started';
    completedLessons: number;
    totalLessons: number;
    completedTasks: number;
    totalTasks: number;
    modules: ModuleProgressDetail[];
  }> {
    const fullLp = await this.lpRepo.findOne({
      where: { id: lpId },
      relations: ['modules', 'modules.lessons', 'modules.assignments'],
    });

    if (!fullLp) {
      return {
        overallProgressPercent: 0,
        status: 'Not Started',
        completedLessons: 0,
        totalLessons: 0,
        completedTasks: 0,
        totalTasks: 0,
        modules: [],
      };
    }

    const modules = (fullLp.modules || []).sort(
      (a, b) => (a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0),
    );

    const modulesDetail: ModuleProgressDetail[] = [];
    let totalLessonsInCourse = 0;
    let completedLessonsInCourse = 0;
    let totalTasksInCourse = 0;
    let completedTasksInCourse = 0;

    for (const m of modules) {
      const lessonIds = (m.lessons || []).map((l) => l.id);
      const assignIds = (m.assignments || []).map((a) => a.id);

      let completedLessonsCount = 0;
      if (lessonIds.length > 0) {
        completedLessonsCount = await this.lessonProgRepo.count({
          where: {
            user: { id: userId },
            lesson: { id: In(lessonIds) },
            isCompleted: true,
          },
        });
      }

      let completedTasksCount = 0;
      if (assignIds.length > 0) {
        completedTasksCount = await this.submissionRepo
          .createQueryBuilder('sub')
          .where('sub.trainee_id = :userId', { userId })
          .andWhere('sub.assignment_id IN (:...assignIds)', { assignIds })
          .andWhere('sub.submitted_at IS NOT NULL')
          .andWhere('UPPER(COALESCE(sub.status, \'\')) NOT IN (:...nonSubmitted)', {
            nonSubmitted: ['AVAILABLE', 'LOCKED', 'DRAFT', ''],
          })
          .getCount();
      }

      const modItems = lessonIds.length + assignIds.length;
      const modDone = completedLessonsCount + completedTasksCount;
      const modPct = modItems > 0 ? Math.min(100, Math.round((modDone / modItems) * 100)) : 0;

      totalLessonsInCourse += lessonIds.length;
      completedLessonsInCourse += completedLessonsCount;
      totalTasksInCourse += assignIds.length;
      completedTasksInCourse += completedTasksCount;

      modulesDetail.push({
        moduleTitle: m.title,
        progressPercent: modPct,
        completedLessons: completedLessonsCount,
        totalLessons: lessonIds.length,
        completedTasks: completedTasksCount,
        totalTasks: assignIds.length,
      });
    }

    const totalItems = totalLessonsInCourse + totalTasksInCourse;
    const totalDone = completedLessonsInCourse + completedTasksInCourse;
    const overallProgressPercent = totalItems > 0 ? Math.min(100, Math.round((totalDone / totalItems) * 100)) : 0;
    const status: 'Completed' | 'In Progress' | 'Not Started' =
      overallProgressPercent === 100 ? 'Completed' : overallProgressPercent > 0 ? 'In Progress' : 'Not Started';

    return {
      overallProgressPercent,
      status,
      completedLessons: completedLessonsInCourse,
      totalLessons: totalLessonsInCourse,
      completedTasks: completedTasksInCourse,
      totalTasks: totalTasksInCourse,
      modules: modulesDetail,
    };
  }

  /**
   * Queries real-time trainee progress, progress percentage, and module-by-module breakdown
   */
  async getTraineeProgress(args: GetTraineeProgressArgs): Promise<TraineeProgressResult> {
    const rawTrainee = (args.trainee_name_or_email || '').trim();
    if (!rawTrainee) {
      return {
        success: false,
        traineeName: 'Unknown',
        traineeEmail: '',
        totalCoursesEnrolled: 0,
        courses: [],
        summary: 'Trainee name or email is required to query progress.',
      };
    }

    const tLower = rawTrainee.toLowerCase();

    // 1. Find matching Trainee user
    const candidateUsers = await this.userRepo.find({
      relations: ['roles', 'primaryRole'],
      take: 200,
    });

    let matchedUser = candidateUsers.find((u) => {
      const full = `${u.firstName || ''} ${u.lastName || ''}`.trim().toLowerCase();
      const email = (u.email || '').trim().toLowerCase();
      return full === tLower || email === tLower;
    });

    if (!matchedUser) {
      matchedUser = candidateUsers.find((u) => {
        const full = `${u.firstName || ''} ${u.lastName || ''}`.trim().toLowerCase();
        const email = (u.email || '').trim().toLowerCase();
        const parts = tLower.split(/\s+/).filter(Boolean);
        return parts.every((p) => full.includes(p)) || email.includes(tLower) || tLower.includes(email);
      });
    }

    if (!matchedUser) {
      return {
        success: false,
        traineeName: rawTrainee,
        traineeEmail: '',
        totalCoursesEnrolled: 0,
        courses: [],
        summary: `No trainee record matching "${rawTrainee}" was found in the database.`,
      };
    }

    const traineeFullName = `${matchedUser.firstName || ''} ${matchedUser.lastName || ''}`.trim() || matchedUser.email;

    // 2. Fetch all enrollments for this trainee
    const enrollments = await this.enrollmentRepo.find({
      where: { user: { id: matchedUser.id } },
      relations: ['learningPath'],
      order: { enrolledAt: 'DESC' },
    });

    const allLps = await this.lpRepo.find({
      where: { status: Not(In(['deleted', 'archived', 'ai_draft'])) },
      select: ['id', 'title', 'status', 'assignedToTraineeIds', 'createdAt'],
    });

    const enrolledMap = new Map<string, { lpId: string; title: string; status: string; enrolledAt: Date | string }>();

    for (const enr of enrollments) {
      if (enr.learningPath) {
        enrolledMap.set(enr.learningPath.id, {
          lpId: enr.learningPath.id,
          title: enr.learningPath.title,
          status: enr.learningPath.status || 'Active',
          enrolledAt: enr.enrolledAt,
        });
      }
    }

    for (const lp of allLps) {
      if (Array.isArray(lp.assignedToTraineeIds) && lp.assignedToTraineeIds.includes(matchedUser.id)) {
        if (!enrolledMap.has(lp.id)) {
          enrolledMap.set(lp.id, {
            lpId: lp.id,
            title: lp.title,
            status: lp.status || 'Active',
            enrolledAt: lp.createdAt,
          });
        }
      }
    }

    if (enrolledMap.size === 0) {
      return {
        success: true,
        traineeName: traineeFullName,
        traineeEmail: matchedUser.email,
        totalCoursesEnrolled: 0,
        courses: [],
        summary: `Trainee ${traineeFullName} (${matchedUser.email}) is registered but not currently enrolled in any Learning Paths.`,
      };
    }

    let targetEntries = Array.from(enrolledMap.values());
    const courseFilterRaw = args.course_name_or_id?.trim();

    if (courseFilterRaw) {
      const cLower = courseFilterRaw.toLowerCase();
      const matched = targetEntries.filter((entry) => {
        const titleLower = entry.title.toLowerCase();
        return (
          entry.lpId.toLowerCase() === cLower ||
          titleLower === cLower ||
          titleLower.includes(cLower) ||
          cLower.includes(titleLower)
        );
      });

      if (matched.length > 0) {
        targetEntries = matched;
      } else {
        const availableTitles = targetEntries.map((e) => `"${e.title}"`).join(', ');
        return {
          success: true,
          traineeName: traineeFullName,
          traineeEmail: matchedUser.email,
          totalCoursesEnrolled: enrolledMap.size,
          courses: [],
          summary: `Trainee ${traineeFullName} is enrolled in ${enrolledMap.size} course(s): ${availableTitles}, but is not enrolled in "${courseFilterRaw}".`,
        };
      }
    }

    // 3. Compute progress for target courses
    const courseProgressList: TraineeCourseProgress[] = [];

    for (const entry of targetEntries) {
      const prog = await this.calcLpProgress(matchedUser.id, entry.lpId);
      courseProgressList.push({
        courseTitle: entry.title,
        courseStatus: entry.status,
        overallProgressPercent: prog.overallProgressPercent,
        status: prog.status,
        completedLessons: prog.completedLessons,
        totalLessons: prog.totalLessons,
        completedTasks: prog.completedTasks,
        totalTasks: prog.totalTasks,
        enrolledAt: entry.enrolledAt ? new Date(entry.enrolledAt).toISOString().split('T')[0] : 'N/A',
        modules: prog.modules,
      });
    }

    const summary = courseProgressList.length === 1
      ? `Trainee ${traineeFullName} has completed ${courseProgressList[0].overallProgressPercent}% of "${courseProgressList[0].courseTitle}" (${courseProgressList[0].status}: ${courseProgressList[0].completedLessons}/${courseProgressList[0].totalLessons} lessons completed, ${courseProgressList[0].completedTasks}/${courseProgressList[0].totalTasks} assessments submitted).`
      : `Retrieved progress for ${traineeFullName} across ${courseProgressList.length} courses.`;

    return {
      success: true,
      traineeName: traineeFullName,
      traineeEmail: matchedUser.email,
      totalCoursesEnrolled: enrolledMap.size,
      courses: courseProgressList,
      summary,
    };
  }

  /**
   * Executes a registered tool by name
   */
  async executeTool(name: string, args: any = {}): Promise<any> {
    if (name === 'get_trainee_users') {
      return await this.getTraineeUsers(args);
    }
    if (name === 'get_learning_paths' || name === 'query_database_learning_paths') {
      return await this.getLearningPaths(args);
    }
    if (name === 'get_trainer_users' || name === 'query_database_trainers') {
      return await this.getTrainerUsers(args);
    }
    if (name === 'get_enrollment_records' || name === 'query_database_enrollments') {
      return await this.getEnrollmentRecords(args);
    }
    if (name === 'get_trainee_progress' || name === 'query_trainee_progress') {
      return await this.getTraineeProgress(args);
    }
    throw new Error(`Unknown MCP tool "${name}"`);
  }

  /**
   * Returns tool schemas formatted for OpenAI / Groq tool calling specification
   */
  getToolsForLlm(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    };
  }> {
    return [
      {
        type: 'function',
        function: {
          name: 'get_trainee_users',
          description:
            'Queries the PostgreSQL database to retrieve the list of all registered trainees with names, emails, active statuses, enrolled course counts, and filter by specific course enrollment.',
          parameters: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['all', 'active', 'inactive'],
                description: 'Filter trainees by active status. Default is "all".',
              },
              search: {
                type: 'string',
                description: 'Optional name or email keyword to search for specific trainees.',
              },
              course_name_or_id: {
                type: 'string',
                description: 'Optional course title or ID to filter trainees enrolled in that specific course.',
              },
              has_assigned_paths: {
                type: 'boolean',
                description: 'Filter trainees who have at least one course assigned.',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of trainees to return (default 50).',
              },
            },
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_learning_paths',
          description:
            'Queries the PostgreSQL database to retrieve total counts, status breakdown (Active vs Draft), difficulty distributions, module/lesson counts, and enrolled trainee counts of Learning Paths.',
          parameters: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['all', 'active', 'draft'],
                description: 'Filter courses by status: "all", "active", or "draft".',
              },
              search: {
                type: 'string',
                description: 'Optional keyword to search learning path titles.',
              },
              difficulty: {
                type: 'string',
                enum: ['all', 'Beginner', 'Intermediate', 'Advanced'],
                description: 'Optional difficulty level filter.',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of paths to return (default 50).',
              },
            },
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_trainer_users',
          description:
            'Queries PostgreSQL for all registered Trainers and Administrators, showing their names, emails, role, and count of authored courses.',
          parameters: {
            type: 'object',
            properties: {
              search: {
                type: 'string',
                description: 'Optional search keyword for trainer name or email.',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of trainers to return (default 50).',
              },
            },
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_enrollment_records',
          description:
            'Queries PostgreSQL for course enrollment and assignment details, linking trainees, courses, and the trainer who assigned them.',
          parameters: {
            type: 'object',
            properties: {
              course_title: {
                type: 'string',
                description: 'Filter enrollments by course title.',
              },
              trainee_search: {
                type: 'string',
                description: 'Filter enrollments by trainee name or email.',
              },
              trainer_search: {
                type: 'string',
                description: 'Filter enrollments by the trainer who assigned the course.',
              },
              status: {
                type: 'string',
                enum: ['all', 'active', 'completed'],
                description: 'Filter enrollment status.',
              },
              limit: {
                type: 'number',
                description: 'Maximum records to return (default 50).',
              },
            },
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_trainee_progress',
          description:
            'Queries real-time progress percentage, completed lessons count, submitted assessments count, and module-by-module breakdown for a trainee in a specific Learning Path or across all their courses.',
          parameters: {
            type: 'object',
            properties: {
              trainee_name_or_email: {
                type: 'string',
                description: 'Name or email of the trainee (e.g. "Revaa Kub", "reva50@ethereal.email").',
              },
              course_name_or_id: {
                type: 'string',
                description: 'Optional course title or ID (e.g. "DevOps Engineering", "Machine Learning").',
              },
            },
            required: ['trainee_name_or_email'],
          },
        },
      },
    ];
  }
}
