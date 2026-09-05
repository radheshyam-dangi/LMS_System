import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { UserEntity } from '../../entities/user.entity';
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { AssignmentEntity } from '../../entities/assignment.entity';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(LearningPathEntity)
    private lpRepo: Repository<LearningPathEntity>,
    @InjectRepository(AssignmentEntity)
    private assignmentRepo: Repository<AssignmentEntity>,
  ) {}

  async globalSearch(query: string, user: any, role: string) {
    const q = `%${query}%`;
    const results: any[] = [];

    // 1. Search Users
    if (role === 'Admin') {
      const users = await this.userRepo
        .createQueryBuilder('user')
        .where('user.deletedAt IS NULL')
        .andWhere(
          new Brackets((qb) => {
            qb.where('user.firstName ILIKE :q', { q })
              .orWhere('user.lastName ILIKE :q', { q })
              .orWhere('user.email ILIKE :q', { q });
          }),
        )
        .take(5)
        .getMany();

      users.forEach((u) => {
        results.push({
          id: u.id,
          title: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
          subtitle: `${u.email} • ${u.roles?.length ? u.roles.join(', ') : u.primaryRole}`,
          type: 'user',
          group: 'Users',
          url: '/users',
        });
      });
    }

    // 2. Search Learning Paths
    let lpQuery = this.lpRepo
      .createQueryBuilder('lp')
      .where('lp.deletedAt IS NULL')
      .andWhere('lp.title ILIKE :q', { q });

    if (role === 'Trainer') {
      lpQuery = lpQuery.andWhere('lp.createdBy = :userId', { userId: user.id });
    } else if (role === 'Trainee') {
      lpQuery = lpQuery.andWhere(`:userId = ANY(lp.assignedToTraineeIds)`, { userId: user.id });
    }

    const paths = await lpQuery.take(5).getMany();
    paths.forEach((p) => {
      results.push({
        id: p.id,
        title: p.title,
        subtitle: p.description?.substring(0, 60) || 'Learning Path',
        type: 'learning_path',
        group: 'Learning Paths',
        url: `/learning-paths/${p.id}`,
      });
    });

    // 3. Search Assignments
    let asgQuery = this.assignmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.learningPath', 'lp')
      .where('a.deletedAt IS NULL')
      .andWhere('a.title ILIKE :q', { q });

    if (role === 'Trainer') {
      asgQuery = asgQuery.andWhere('a.createdBy = :userId', { userId: user.id });
    } else if (role === 'Trainee') {
      // Basic check: if it's external, check assignedToTraineeIds
      // Otherwise, assume Trainee assignments view handles deep permission checks.
      // For global search, we will restrict to assignments created by someone or assigned to the trainee
      asgQuery = asgQuery.andWhere(`(:userId = ANY(a.assignedToTraineeIds) OR a.isExternal = false)`, { userId: user.id });
    }

    const assignments = await asgQuery.take(5).getMany();
    assignments.forEach((a) => {
      results.push({
        id: a.id,
        title: a.title,
        subtitle: `Type: ${a.assignmentType || 'Subjective'} ${a.learningPath ? `• Path: ${a.learningPath.title}` : ''}`,
        type: 'assignment',
        group: 'Assignments',
        url: '/assignments',
      });
    });

    return { results };
  }
}
