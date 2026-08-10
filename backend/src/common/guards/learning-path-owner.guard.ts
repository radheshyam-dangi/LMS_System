import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LearningPathEntity } from '../../databaseOrm/entities/learningPath.entity';
import { ModuleEntity } from '../../databaseOrm/entities/module.entity';
import { LessonEntity } from '../../databaseOrm/entities/lesson.entity';
import { AssignmentEntity } from '../../databaseOrm/entities/assignment.entity';

@Injectable()
export class LearningPathOwnerGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Access denied: User session missing.');
    }

    // 1. ADMIN BYPASS: System Admins have unrestricted CRUD rights
    const userRole = (user.role || user.primaryRole || '').toLowerCase();
    if (userRole === 'admin') {
      return true;
    }

    // 2. READ-ONLY METHOD BYPASS: GET requests are allowed for all Trainers
    if (request.method === 'GET') {
      return true;
    }

    const currentUserId = user.id || user.sub;
    const { params, body, query } = request;

    let targetPathOwnerId: string | null = null;

    // Extract potential entity IDs from Route Params, Body, or Query
    const pathId = params.id || params.pathId || body.learningPathId || query.learningPathId;
    const moduleId = params.id || params.moduleId || body.moduleId || query.moduleId;
    const lessonId = params.id || params.lessonId || body.lessonId || query.lessonId;

    // 3. RESOLVE OWNER ID ACCORDING TO ENTITY TYPE & ROUTE CONTEXT
    if (pathId && (request.baseUrl.includes('learning-paths') || body.learningPathId)) {
      const path = await this.dataSource.getRepository(LearningPathEntity).findOne({
        where: { id: pathId },
        relations: ['createdBy'],
      });
      if (!path) throw new NotFoundException(`Learning Path "${pathId}" not found.`);
      targetPathOwnerId = path.createdBy?.id || (path as any).createdById;
    } 
    else if (moduleId && request.baseUrl.includes('modules')) {
      const module = await this.dataSource.getRepository(ModuleEntity).findOne({
        where: { id: moduleId },
        relations: ['learningPath', 'learningPath.createdBy'],
      });
      if (!module) throw new NotFoundException(`Module "${moduleId}" not found.`);
      targetPathOwnerId = module.learningPath?.createdBy?.id || (module.learningPath as any)?.createdById;
    } 
    else if (lessonId && request.baseUrl.includes('lessons')) {
      const lesson = await this.dataSource.getRepository(LessonEntity).findOne({
        where: { id: lessonId },
        relations: ['module', 'module.learningPath', 'module.learningPath.createdBy'],
      });
      if (!lesson) throw new NotFoundException(`Lesson "${lessonId}" not found.`);
      targetPathOwnerId = lesson.module?.learningPath?.createdBy?.id || (lesson.module?.learningPath as any)?.createdById;
    } 
    else if (params.id && request.baseUrl.includes('assignments')) {
      const assignment = await this.dataSource.getRepository(AssignmentEntity).findOne({
        where: { id: params.id },
        relations: ['lesson', 'lesson.module', 'lesson.module.learningPath', 'lesson.module.learningPath.createdBy'],
      });
      if (assignment) {
        targetPathOwnerId = assignment.lesson?.module?.learningPath?.createdBy?.id || (assignment.lesson?.module?.learningPath as any)?.createdById;
      }
    }

    // 4. VERIFY OWNERSHIP MATCH
    if (targetPathOwnerId && targetPathOwnerId === currentUserId) {
      return true;
    }

    throw new ForbiddenException(
      'Read-Only Access: You are not authorized to modify or delete this content. Only the LearningPath Owner or an Admin can perform CRUD operations.'
    );
  }
}