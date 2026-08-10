import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LearningPathEntity } from '../../databaseOrm/entities/learningPath.entity';
@Injectable()
export class PathOwnershipGuard implements CanActivate {
  constructor(private readonly datasource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Admins bypass ownership restrictions
    if (user?.role?.toLowerCase() === 'admin') return true;

    const pathId = request.params.pathId || request.body.learningPathId || request.query.learningPathId;
    if (!pathId) return true; // Let downstream service/validation handle missing ID

    const repo = this.datasource.getRepository(LearningPathEntity);
    const path = await repo.findOne({
      where: { id: pathId },
      relations: ['createdBy'],
    });

    if (!path) {
      throw new NotFoundException(`Learning Path with ID "${pathId}" not found.`);
    }

    const isOwner = path.createdBy?.id === (user.id || user.sub);
    if (!isOwner) {
      throw new ForbiddenException('Only the Trainer who created this Learning Path can modify its content.');
    }

    return true;
  }
}