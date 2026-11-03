import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource, ILike, Repository } from 'typeorm';
import { FastMCP } from '@prefecthq/fastmcp-ts/server';
import { UserEntity } from '../databaseOrm/entities/user.entity';
import { EnrollmentEntity } from '../databaseOrm/entities/enrollment.entity';

export interface GetTraineesArgs {
  status?: 'all' | 'active' | 'inactive';
  search?: string;
  limit?: number;
}

export interface TraineeRecord {
  fullName: string;
  email: string;
  status: 'Active' | 'Inactive';
  isActive: boolean;
  joinedDate: string;
  enrolledPathsCount: number;
  streak: number;
}

export interface TraineesQueryResult {
  success: boolean;
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  filterApplied: {
    status: string;
    search?: string;
  };
  trainees: TraineeRecord[];
}

@Injectable()
export class PostgresMcpService implements OnModuleInit {
  private readonly logger = new Logger(PostgresMcpService.name);
  private fastMcpServer!: FastMCP;
  private userRepo!: Repository<UserEntity>;
  private enrollmentRepo!: Repository<EnrollmentEntity>;

  constructor(private readonly dataSource: DataSource) {
    this.userRepo = this.dataSource.getRepository(UserEntity);
    this.enrollmentRepo = this.dataSource.getRepository(EnrollmentEntity);
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

    // Register get_trainee_users MCP Tool
    this.fastMcpServer.tool(
      {
        name: 'get_trainee_users',
        description:
          'Fetches registered users with the Trainee role from the PostgreSQL database in JSON format. Provides name, email, active status, join date, streak, and enrolled course counts without exposing sensitive passwords or internal UUIDs.',
      },
      async (args: GetTraineesArgs = {}) => {
        return await this.getTraineeUsers(args);
      },
    );

    this.logger.log('FastMCP PostgreSQL server initialized with get_trainee_users tool.');
  }

  /**
   * Core tool execution logic: queries PostgreSQL and returns sanitized Trainee records in JSON
   */
  async getTraineeUsers(args: GetTraineesArgs = {}): Promise<TraineesQueryResult> {
    const status = args.status || 'all';
    const search = args.search?.trim().toLowerCase();
    const limit = Math.min(Math.max(args.limit || 50, 1), 100);

    try {
      // 1. Fetch users with Trainee role (checking both primaryRole and roles list)
      const users = await this.userRepo.find({
        relations: ['roles', 'primaryRole'],
        where: [
          { roles: { name: ILike('Trainee') } },
          { primaryRole: { name: ILike('Trainee') } },
        ],
        order: { createdAt: 'DESC' },
        take: limit * 2, // Fetch buffer to allow post-filtering
      });

      // De-duplicate users (in case both relations match)
      const userMap = new Map<string, UserEntity>();
      for (const u of users) {
        userMap.set(u.id, u);
      }
      let uniqueUsers = Array.from(userMap.values());

      // 2. Filter by status (active / inactive / all)
      if (status === 'active') {
        uniqueUsers = uniqueUsers.filter((u) => u.isActive === true);
      } else if (status === 'inactive') {
        uniqueUsers = uniqueUsers.filter((u) => u.isActive === false);
      }

      // 3. Optional search filter by name or email
      if (search) {
        uniqueUsers = uniqueUsers.filter((u) => {
          const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
          const email = (u.email || '').toLowerCase();
          return fullName.includes(search) || email.includes(search);
        });
      }

      // Apply final limit
      const finalUsers = uniqueUsers.slice(0, limit);

      // 4. Batch count enrollments per trainee
      const enrollmentCounts = new Map<string, number>();
      if (finalUsers.length > 0) {
        const userIds = finalUsers.map((u) => u.id);
        const enrollments = await this.enrollmentRepo
          .createQueryBuilder('enrollment')
          .select('enrollment.userId', 'userId')
          .addSelect('COUNT(enrollment.id)', 'count')
          .where('enrollment.userId IN (:...userIds)', { userIds })
          .groupBy('enrollment.userId')
          .getRawMany();

        for (const row of enrollments) {
          enrollmentCounts.set(row.userId, parseInt(row.count, 10) || 0);
        }
      }

      // 5. Sanitize trainee records (strictly no passwords, hashes, or technical database UUIDs)
      const trainees: TraineeRecord[] = finalUsers.map((u) => {
        const first = u.firstName?.trim() || '';
        const last = u.lastName?.trim() || '';
        const fullName = `${first} ${last}`.trim() || 'Anonymous Trainee';
        return {
          fullName,
          email: u.email,
          status: u.isActive ? 'Active' : 'Inactive',
          isActive: Boolean(u.isActive),
          joinedDate: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : 'N/A',
          enrolledPathsCount: enrollmentCounts.get(u.id) || 0,
          streak: u.lastCelebratedStreak || 0,
        };
      });

      const activeCount = trainees.filter((t) => t.isActive).length;
      const inactiveCount = trainees.filter((t) => !t.isActive).length;

      return {
        success: true,
        totalCount: trainees.length,
        activeCount,
        inactiveCount,
        filterApplied: {
          status,
          search: search || undefined,
        },
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
        trainees: [],
      };
    }
  }

  /**
   * Executes a registered tool by name
   */
  async executeTool(name: string, args: any = {}): Promise<any> {
    if (name === 'get_trainee_users') {
      return await this.getTraineeUsers(args);
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
            'Queries the PostgreSQL database to retrieve the list of all registered trainees in the system with their names, emails, active/inactive statuses, join dates, and enrolled path counts.',
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
              limit: {
                type: 'number',
                description: 'Maximum number of trainees to return (default 50).',
              },
            },
            required: [],
          },
        },
      },
    ];
  }
}

